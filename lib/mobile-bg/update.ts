import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { getStorageRoot, type DealerBackupConfig } from '@/lib/mobile-bg/backup';
import { applyCapturedMobileBgDraft, buildBackupFieldOverrides, selectMobileBgDependentFields } from '@/lib/mobile-bg/draft';
import { captureEditFormSnapshot, submitMyAdsEditForm } from '@/lib/mobile-bg/edit-form';

interface BackupRow {
  id: number;
  listing_id: number | null;
  mobile_id: string | null;
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: string | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string | null;
}

interface EditSnapshotRow {
  id: number;
  listing_token: string | null;
  source_url: string | null;
  fields_json: string | null;
  checked_boxes_json: string | null;
}

function getLatestEditSnapshot(
  db: Database.Database,
  backupId: number,
  mobileId: string,
): EditSnapshotRow | undefined {
  return db.prepare(`
    SELECT id, listing_token, source_url, fields_json, checked_boxes_json
    FROM mobilebg_edit_form_snapshots
    WHERE backup_id = ? OR mobile_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(backupId, mobileId) as EditSnapshotRow | undefined;
}

function getUpdateDir(dbPath: string, dealerSlug: string, backupId: number): string {
  return path.join(getStorageRoot(dbPath), dealerSlug, 'updates', String(backupId));
}

export async function updateBackupOnMobileBg(
  db: Database.Database,
  dealer: DealerBackupConfig,
  backupId: number,
  dbPath: string,
): Promise<{ mobileId: string }> {
  const backup = db.prepare(`
    SELECT
      id, listing_id, mobile_id, title, source_title, price_amount, vat_included,
      mileage, fuel, power, engine, color, transmission, category, description
    FROM mobilebg_backups
    WHERE id = ?
  `).get(backupId) as BackupRow | undefined;

  if (!backup?.mobile_id) {
    throw new Error(`Backup ${backupId} not found or missing mobile ID`);
  }

  let editSnapshot = getLatestEditSnapshot(db, backupId, backup.mobile_id);

  if (!editSnapshot?.listing_token || !editSnapshot.fields_json) {
    await captureEditFormSnapshot(db, dealer, backup.mobile_id, dbPath);
    editSnapshot = getLatestEditSnapshot(db, backupId, backup.mobile_id);
  }

  if (!editSnapshot?.listing_token || !editSnapshot.fields_json) {
    throw new Error(`No edit form snapshot found for backup ${backupId} after auto-capture`);
  }

  const fields = JSON.parse(editSnapshot.fields_json) as Array<Record<string, unknown>>;
  const checkedBoxes = JSON.parse(editSnapshot.checked_boxes_json || '[]').map((x: { name: string; value: string }) => `${x.name}::${x.value}`);
  const fieldOverrides = buildBackupFieldOverrides(backup);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const updateDir = getUpdateDir(dbPath, dealer.slug, backupId);
  await fsp.mkdir(updateDir, { recursive: true });
  const startedAt = new Date().toISOString();
  db.prepare(`
    UPDATE mobilebg_backups
    SET last_mobile_sync_status = 'running', last_mobile_sync_error = NULL, updated_at = ?
    WHERE id = ?
  `).run(startedAt, backup.id);

  try {
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    await page.goto(
      editSnapshot.source_url || 'https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForTimeout(1500);
    await acceptMobileBgCookies(page);

    await submitMyAdsEditForm(page, backup.mobile_id, editSnapshot.listing_token);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1800);
    await acceptMobileBgCookies(page);

    await selectMobileBgDependentFields(page, fields);
    await applyCapturedMobileBgDraft(page, fields, checkedBoxes, fieldOverrides);

    const beforeSubmitPath = path.join(updateDir, 'before-submit.png');
    await page.screenshot({ path: beforeSubmitPath, fullPage: true });

    await acceptMobileBgCookies(page);
    const submitButton = page.locator('#pubButton, input[type="submit"], a.pubButton').first();
    if (await submitButton.count() === 0) {
      throw new Error('Could not find mobile.bg save button');
    }

    await submitButton.click({ force: true });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    await acceptMobileBgCookies(page);

    const afterSubmitPath = path.join(updateDir, 'after-submit.png');
    await page.screenshot({ path: afterSubmitPath, fullPage: true });

    const bodyText = (await page.textContent('body').catch(() => '')) || '';
    const successState =
      bodyText.includes('Избор на тип промотиране') ||
      bodyText.includes('Преглед на обявата') ||
      bodyText.includes('Вашата обява') ||
      bodyText.includes('Моите обяви');
    const stillOnEditForm =
      bodyText.includes('Допълнителна информация') &&
      bodyText.includes('Данни за обратна връзка') &&
      bodyText.includes('Марка');
    const hasValidationError =
      stillOnEditForm &&
      (bodyText.includes('Попълнете') ||
        bodyText.includes('греш') ||
        bodyText.includes('задължител') ||
        bodyText.includes('Невалид'));

    if (!successState && hasValidationError) {
      throw new Error('Mobile.bg rejected the update form');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE mobilebg_backups
      SET
        draft_needs_sync = 0,
        last_mobile_sync_status = 'success',
        last_mobile_sync_error = NULL,
        last_mobile_sync_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(now, now, backup.id);

    return { mobileId: backup.mobile_id };
  } catch (error) {
    const debugPath = path.join(updateDir, 'error.png');
    await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {});
    db.prepare(`
      UPDATE mobilebg_backups
      SET last_mobile_sync_status = 'failed', last_mobile_sync_error = ?, updated_at = ?
      WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), new Date().toISOString(), backup.id);
    throw error;
  } finally {
    await browser.close();
  }
}
