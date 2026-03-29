import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { getStorageRoot, type DealerBackupConfig } from '@/lib/mobile-bg/backup';

interface BackupRow {
  id: number;
  mobile_id: string | null;
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
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
    SELECT id, listing_id, mobile_id, title, source_title, price_amount
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
    JSON.parse(editSnapshot.checked_boxes_json || '[]').map((x: { name: string; value: string }) => `${x.name}::${x.value}`),
  );

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

    const selectAndMaybeSubmit = async (fieldName: string, fieldValue: string, submitForm: boolean) => {
      await page.evaluate(({ fieldName: name, fieldValue: value, submitForm: submit }) => {
        const el = document.querySelector(`[name="${name}"]`) as HTMLSelectElement | null;
        if (!el) return;
        const opt = Array.from(el.options).find((option) =>
          String(option.value) === String(value) || option.textContent?.trim() === String(value),
        );
        if (!opt) return;
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (submit) {
          const form = (document as Document & { pub?: HTMLFormElement }).pub;
          form?.submit();
        }
      }, { fieldName, fieldValue, submitForm });
      if (submitForm) {
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1500);
      }
    };

    const brandField = fields.find((field) => field.name === 'f5' && field.value) as { value?: string } | undefined;
    const modelField = fields.find((field) => field.name === 'f6' && field.value) as { value?: string } | undefined;
    const regionField = fields.find((field) => field.name === 'f18' && field.value) as { value?: string } | undefined;
    const cityField = fields.find((field) => field.name === 'f19' && field.value) as { value?: string } | undefined;

    if (brandField?.value) await selectAndMaybeSubmit('f5', brandField.value, true);
    if (modelField?.value) await selectAndMaybeSubmit('f6', modelField.value, false);
    if (regionField?.value) await selectAndMaybeSubmit('f18', regionField.value, true);
    if (cityField?.value) await selectAndMaybeSubmit('f19', cityField.value, false);

    await page.evaluate(({ capturedFields, capturedCheckboxes, priceOverride }) => {
      const checkboxSet = new Set(capturedCheckboxes);
      const skip = new Set(['f5', 'f6', 'f18', 'f19']);
      const editable = capturedFields.filter((field: Record<string, unknown>) =>
        field.name && !skip.has(String(field.name)) && !['hidden', 'file'].includes(String(field.type || '')),
      );

      const setValue = (element: HTMLInputElement | HTMLTextAreaElement, value: unknown) => {
        element.value = String(value ?? '');
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };

      for (const field of editable) {
        const element = document.querySelector(`[name="${String(field.name)}"]`) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!element) continue;

        if (field.tag === 'select') {
          const select = element as HTMLSelectElement;
          const option = Array.from(select.options).find((opt) =>
            String(opt.value) === String(field.value) || opt.textContent?.trim() === String(field.value),
          );
          if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          continue;
        }

        if (field.type === 'checkbox') {
          const input = element as HTMLInputElement;
          input.checked = checkboxSet.has(`${String(field.name)}::${String(field.value)}`);
          input.dispatchEvent(new Event('change', { bubbles: true }));
          continue;
        }

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          setValue(element, field.value);
        }
      }

      const priceEl = document.querySelector('[name="f12"]') as HTMLInputElement | null;
      if (priceEl) setValue(priceEl, priceOverride);

      const pubForm = (document as Document & { pub?: HTMLFormElement }).pub;
      if (pubForm && !pubForm.querySelector('[name="nup"]')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.name = 'nup';
        hidden.value = '013';
        pubForm.appendChild(hidden);
      }
    }, {
      capturedFields: fields,
      capturedCheckboxes: Array.from(checkedBoxes),
      priceOverride: backup.price_amount,
    });

    await page.waitForTimeout(800);
    await page.locator('#pubButton').click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const uploadInput = page.locator('input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]').first();
    for (const image of images) {
      const responsePromise = page.waitForResponse((response) => response.url().includes('upload.cgi'), { timeout: 30000 });
      await uploadInput.setInputFiles(image.local_path);
      await responsePromise;
      await page.waitForTimeout(300);
    }

    const previewScreenshotPath = path.join(repostDir, 'repost-preview.png');
    await page.screenshot({ path: previewScreenshotPath, fullPage: true });

    const continueButton = page.locator('a.pubButton, a:has-text("ПРОДЪЛЖИ"), input[value="ПРОДЪЛЖИ"]').first();
    if (await continueButton.count() > 0) {
      await continueButton.click();
    } else {
      await page.evaluate(() => {
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
        await viewButton.click();
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
