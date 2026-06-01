import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { DealerBackupConfig, USER_AGENT } from '@/lib/mobile-bg/constants';
import { applyCapturedMobileBgDraft, buildBackupFieldOverrides, selectMobileBgDependentFields } from '@/lib/mobile-bg/draft';
import {
  buildDraftPublishFields,
} from '@/lib/mobile-bg/repost-form-fields';
import {
  createRepostJob,
  markBackupPublished,
  markRepostJobCompleted,
  markRepostJobFailed,
} from '@/lib/mobile-bg/repost-jobs';
import type { BackupImageRow, BackupRow, EditSnapshotRow } from '@/lib/mobile-bg/repost-types';
import { SCRAPED_ROOT } from '@/lib/storage-paths';
import { markSyncFailed, markSyncRunning } from '@/lib/mobile-bg/sync-status';
import { normalizeVatValue } from '@/lib/vat';
import { getExtraLabels } from '@/lib/mobile-bg/extras';
import { errorMessage, parseJson } from '@/lib/utils';
import {
  continueMobileBgPublish,
  resolvePublishedMobileBgListing,
  uploadMobileBgBackupImages,
} from '@/lib/mobile-bg/repost-page-flow';

function getRepostDir(dealerSlug: string, backupId: number): string {
  return path.join(SCRAPED_ROOT, dealerSlug, 'reposts', String(backupId));
}

async function applyBlankDraftExtras(page: import('playwright').Page, labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  await page.evaluate((desiredLabels) => {
    const desired = new Set(desiredLabels.map((label) => label.trim()));
    const inputs = Array.from(document.querySelectorAll('input[type="checkbox"][name^="f"]')) as HTMLInputElement[];
    for (const input of inputs) {
      const textBlob = [
        input.closest('label')?.textContent,
        input.parentElement?.textContent,
        input.closest('td')?.textContent,
        input.nextSibling?.textContent,
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      if (desired.has(textBlob) && !input.checked) {
        input.click();
      }
    }
  }, labels);
}

async function publishDraftBackupFromDb(
  db: Database.Database,
  dealer: DealerBackupConfig,
  backup: BackupRow,
  jobId: number,
  repostDir: string,
): Promise<{ jobId: number; targetMobileId: string }> {
  const images = db.prepare(`
    SELECT local_path
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backup.id) as BackupImageRow[];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  markSyncRunning(db, backup.id);

  try {
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    const { region, city, fieldOverrides, dependentFields, editableFields, pubtype } =
      buildDraftPublishFields(backup);
    await page.goto(`https://www.mobile.bg/pcgi/mobile.cgi?pubtype=${encodeURIComponent(pubtype)}&act=6&subact=4&actions=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await acceptMobileBgCookies(page);

    if (!backup.make || !backup.model) {
      throw new Error('Draft is missing make/model');
    }
    if (!region || !city) {
      throw new Error('Draft is missing region/city');
    }

    await selectMobileBgDependentFields(page, dependentFields);
    await applyCapturedMobileBgDraft(page, editableFields, [], fieldOverrides);
    await applyBlankDraftExtras(page, getExtraLabels(backup.extras_json));
    await page.evaluate(() => {
      const pubForm = (document as Document & { pub?: HTMLFormElement }).pub;
      if (!pubForm && !document.querySelector('form[name="pub"]')) {
        throw new Error('Publish form not found');
      }
    });

    await page.waitForTimeout(800);
    await acceptMobileBgCookies(page);
    await page.evaluate(() => {
      document.getElementById('cookiescript_injected_wrapper')?.remove();
      document.getElementById('cookiescript_injected')?.remove();
      const pubForm = (document as Document & { pub?: HTMLFormElement }).pub || document.querySelector('form[name="pub"]') as HTMLFormElement | null;
      if (!pubForm) throw new Error('Publish form not found');
      const actions = pubForm.querySelector('[name="actions"]') as HTMLInputElement | null;
      if (actions) actions.value = '2';
      if (!pubForm.querySelector('[name="nup"]')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'nup';
        hidden.value = '013';
        pubForm.appendChild(hidden);
      }
      pubForm.submit();
    });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await acceptMobileBgCookies(page);

    await uploadMobileBgBackupImages(page, images, repostDir, 'draft-publish');

    const previewScreenshotPath = path.join(repostDir, 'repost-preview.png');
    await page.screenshot({ path: previewScreenshotPath, fullPage: true });

    await continueMobileBgPublish(page);
    const { resultUrl, targetMobileId } = await resolvePublishedMobileBgListing(page);

    if (!targetMobileId) {
      throw new Error('Publish completed but no new listing ID was found');
    }

    const now = currentIsoTimestamp();
    let listingId = backup.listing_id ?? null;
    if (!listingId) {
      const listingResult = runInsert(db, 'listings', {
        mobile_id: targetMobileId,
        dealer_id: dealer.id,
        url: resultUrl,
        title: backup.title || backup.source_title || '',
        make: backup.make,
        model: backup.model,
        reg_year: backup.year ? String(backup.year) : null,
        fuel: backup.fuel,
        color: backup.color,
        power: backup.power,
        mileage: backup.mileage,
        description: backup.description,
        ad_status: 'none',
        kaparo: 0,
        is_new: 1,
        last_edit: now,
        current_price: backup.price_amount,
        vat: normalizeVatValue(backup.vat_included),
        image_count: images.length,
        first_seen_at: now,
        last_seen_at: now,
        is_active: 1,
        body_type: backup.category,
        transmission: backup.transmission,
      });
      listingId = Number(listingResult.lastInsertRowid);
    }

    markBackupPublished(db, backup.id, { listingId, targetMobileId, resultUrl, now });
    markRepostJobCompleted(db, jobId, {
      targetMobileId,
      previewScreenshotPath,
      repostDir,
      resultUrl,
      now,
    });

    return { jobId, targetMobileId };
  } catch (error) {
    markRepostJobFailed(db, jobId, {
      message: errorMessage(error),
      repostDir,
    });
    markSyncFailed(db, backup.id, error);
    throw error;
  } finally {
    await browser.close();
  }
}

export async function repostBackupFromDb(
  db: Database.Database,
  dealer: DealerBackupConfig,
  backupId: number,
): Promise<{ jobId: number; targetMobileId: string }> {
  const backup = db.prepare(`
    SELECT
      id, dealer_id, listing_id, mobile_id, source_url, title, source_title, price_amount, vat_included,
      year, mileage, fuel, power, engine, color, transmission, category, description,
      make, model, extras_json, tech_data_json
    FROM mobilebg_backups
    WHERE id = ?
  `).get(backupId) as BackupRow | undefined;

  if (!backup) throw new Error(`Backup ${backupId} not found`);

  const editSnapshot = db.prepare(`
    SELECT id, listing_token, fields_json, checked_boxes_json
    FROM mobilebg_edit_form_snapshots
    WHERE backup_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(backupId) as EditSnapshotRow | undefined;

  const jobId = createRepostJob(db, dealer.id, backupId, backup.listing_id ?? null, backup.mobile_id);
  const repostDir = getRepostDir(dealer.slug, backupId);
  await fsp.mkdir(repostDir, { recursive: true });

  if (!backup.mobile_id) {
    return publishDraftBackupFromDb(db, dealer, backup, jobId, repostDir);
  }

  if (!editSnapshot?.fields_json) {
    throw new Error(`No edit form snapshot found for backup ${backupId}`);
  }

  const images = db.prepare(`
    SELECT local_path
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backupId) as BackupImageRow[];

  const fields = JSON.parse(editSnapshot.fields_json) as Array<Record<string, unknown>>;
  const checkedBoxes = new Set(
    parseJson<Array<{ name: string; value: string }>>(editSnapshot.checked_boxes_json, []).map(
      (x) => `${x.name}::${x.value}`,
    ),
  );
  const backupFieldOverrides = buildBackupFieldOverrides(backup);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await acceptMobileBgCookies(page);

    await selectMobileBgDependentFields(page, fields);
    await applyCapturedMobileBgDraft(
      page,
      fields,
      Array.from(checkedBoxes),
      backupFieldOverrides,
    );
    await page.evaluate(() => {
      const pubForm = (document as Document & { pub?: HTMLFormElement }).pub;
      if (pubForm && !pubForm.querySelector('[name="nup"]')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'nup';
        hidden.value = '013';
        pubForm.appendChild(hidden);
      }
    });

    await page.waitForTimeout(800);
    await acceptMobileBgCookies(page);
    await page.evaluate(() => {
      document.getElementById('cookiescript_injected_wrapper')?.remove();
      document.getElementById('cookiescript_injected')?.remove();
      const pubForm = (document as Document & { pub?: HTMLFormElement }).pub;
      if (!pubForm) throw new Error('Publish form not found');
      const actions = pubForm.querySelector('[name="actions"]') as HTMLInputElement | null;
      if (actions) actions.value = '2';
      pubForm.submit();
    });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await acceptMobileBgCookies(page);

    await uploadMobileBgBackupImages(page, images, repostDir, 'repost');

    const previewScreenshotPath = path.join(repostDir, 'repost-preview.png');
    await page.screenshot({ path: previewScreenshotPath, fullPage: true });

    await continueMobileBgPublish(page);
    const { resultUrl, targetMobileId } = await resolvePublishedMobileBgListing(page, { clickViewButton: true });

    if (!targetMobileId) {
      throw new Error('Repost completed but no new listing ID was found');
    }

    const now = currentIsoTimestamp();
    markRepostJobCompleted(db, jobId, {
      targetMobileId,
      previewScreenshotPath,
      repostDir,
      resultUrl,
      now,
    });

    return { jobId, targetMobileId };
  } catch (error) {
    markRepostJobFailed(db, jobId, {
      message: errorMessage(error),
      repostDir,
    });
    throw error;
  } finally {
    await browser.close();
  }
}
