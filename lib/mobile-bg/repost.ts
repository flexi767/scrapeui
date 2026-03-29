import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { getStorageRoot, type DealerBackupConfig } from '@/lib/mobile-bg/backup';
import { applyCapturedMobileBgDraft, buildBackupFieldOverrides, selectMobileBgDependentFields } from '@/lib/mobile-bg/draft';

interface BackupRow {
  id: number;
  mobile_id: string | null;
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: number | null;
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
  fields_json: string | null;
  checked_boxes_json: string | null;
}

interface BackupImageRow {
  local_path: string;
}

function getRepostDir(dbPath: string, dealerSlug: string, backupId: number): string {
  return path.join(getStorageRoot(dbPath), dealerSlug, 'reposts', String(backupId));
}

function createRepostJob(db: Database.Database, dealerId: number, backupId: number, listingId: number | null, sourceMobileId: string | null): number {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO mobilebg_repost_jobs (dealer_id, backup_id, listing_id, source_mobile_id, status, started_at, created_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `).run(dealerId, backupId, listingId, sourceMobileId, now, now);
  return Number(result.lastInsertRowid);
}

export async function repostBackupFromDb(
  db: Database.Database,
  dealer: DealerBackupConfig,
  backupId: number,
  dbPath: string,
): Promise<{ jobId: number; targetMobileId: string }> {
  const backup = db.prepare(`
    SELECT
      id, listing_id, mobile_id, title, source_title, price_amount, vat_included,
      mileage, fuel, power, engine, color, transmission, category, description
    FROM mobilebg_backups
    WHERE id = ?
  `).get(backupId) as (BackupRow & { listing_id?: number | null }) | undefined;

  if (!backup) throw new Error(`Backup ${backupId} not found`);

  const editSnapshot = db.prepare(`
    SELECT id, listing_token, fields_json, checked_boxes_json
    FROM mobilebg_edit_form_snapshots
    WHERE backup_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(backupId) as EditSnapshotRow | undefined;

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
    (JSON.parse(editSnapshot.checked_boxes_json || '[]') as Array<{ name: string; value: string }>).map(
      (x) => `${x.name}::${x.value}`,
    ),
  );
  const backupFieldOverrides = buildBackupFieldOverrides(backup);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const jobId = createRepostJob(db, dealer.id, backupId, backup.listing_id ?? null, backup.mobile_id);
  const repostDir = getRepostDir(dbPath, dealer.slug, backupId);
  await fsp.mkdir(repostDir, { recursive: true });

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

    const uploadInput = page.locator('input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]').first();
    for (const image of images) {
      const responsePromise = page.waitForResponse((response) => response.url().includes('upload.cgi'), { timeout: 30000 });
      await uploadInput.setInputFiles(image.local_path);
      await responsePromise;
      await page.waitForTimeout(300);
    }

    const previewScreenshotPath = path.join(repostDir, 'repost-preview.png');
    await page.screenshot({ path: previewScreenshotPath, fullPage: true });

    await acceptMobileBgCookies(page);
    const continueButton = page.locator('a.pubButton, a:has-text("ПРОДЪЛЖИ"), input[value="ПРОДЪЛЖИ"]').first();
    if (await continueButton.count() > 0) {
      await continueButton.click({ force: true });
    } else {
      await page.evaluate(() => {
        document.getElementById('cookiescript_injected_wrapper')?.remove();
        document.getElementById('cookiescript_injected')?.remove();
        const steps = (document as Document & { steps?: HTMLFormElement }).steps;
        if (steps) {
          const step = steps.querySelector('[name="step"]') as HTMLInputElement | null;
          const actions = steps.querySelector('[name="actions"]') as HTMLInputElement | null;
          if (step) step.value = '3';
          if (actions) actions.value = '22';
          steps.submit();
        }
      });
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2500);

    let resultUrl = page.url();
    let resultText = (await page.textContent('body').catch(() => '')) || '';
    let targetMobileId =
      resultUrl.match(/obiava-(\d+)/)?.[1]
      || resultText.match(/Обява:\s*(\d{15,})/)?.[1]
      || resultText.match(/showPrintPDF\('?(\d{15,})'?/)?.[1]
      || null;

    if (!targetMobileId) {
      const viewButton = page.locator('a:has-text("Преглед на обявата")').first();
      if (await viewButton.count() > 0) {
        const href = await viewButton.getAttribute('href');
        targetMobileId =
          href?.match(/obiava-(\d+)/)?.[1]
          || targetMobileId;
        if (href) {
          resultUrl = href;
        } else {
          await acceptMobileBgCookies(page);
          await viewButton.click({ force: true });
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(1800);
          resultUrl = page.url();
          resultText = (await page.textContent('body').catch(() => '')) || '';
          targetMobileId =
            resultUrl.match(/obiava-(\d+)/)?.[1]
            || resultText.match(/Обява:\s*(\d{15,})/)?.[1]
            || resultText.match(/showPrintPDF\('?(\d{15,})'?/)?.[1]
            || null;
        }
      }
    }

    if (!targetMobileId) {
      throw new Error('Repost completed but no new listing ID was found');
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE mobilebg_repost_jobs
      SET status = 'completed', target_mobile_id = ?, preview_screenshot_path = ?, debug_dir = ?, message = ?, finished_at = ?
      WHERE id = ?
    `).run(targetMobileId, previewScreenshotPath, repostDir, resultUrl, now, jobId);

    return { jobId, targetMobileId };
  } catch (error) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE mobilebg_repost_jobs
      SET status = 'failed', message = ?, debug_dir = ?, finished_at = ?
      WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), repostDir, now, jobId);
    throw error;
  } finally {
    await browser.close();
  }
}
