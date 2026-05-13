import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { DealerBackupConfig, USER_AGENT } from '@/lib/mobile-bg/constants';
import { applyCapturedMobileBgDraft, buildBackupFieldOverrides, selectMobileBgDependentFields } from '@/lib/mobile-bg/draft';
import { SCRAPED_ROOT } from '@/lib/storage-paths';
import { markSyncFailed, markSyncRunning } from '@/lib/mobile-bg/sync-status';
import { normalizeVatValue } from '@/lib/vat';
import { getExtraLabels } from '@/lib/mobile-bg/extras';
import { errorMessage } from '@/lib/utils';

interface BackupRow {
  id: number;
  dealer_id?: number | null;
  listing_id?: number | null;
  mobile_id: string | null;
  source_url: string | null;
  title: string | null;
  source_title: string | null;
  price_amount: number | null;
  vat_included: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string | null;
  make: string | null;
  model: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
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

function getRepostDir(dealerSlug: string, backupId: number): string {
  return path.join(SCRAPED_ROOT, dealerSlug, 'reposts', String(backupId));
}

function createRepostJob(db: Database.Database, dealerId: number, backupId: number, listingId: number | null, sourceMobileId: string | null): number {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO mobilebg_repost_jobs (dealer_id, backup_id, listing_id, source_mobile_id, status, started_at, created_at)
    VALUES (?, ?, ?, ?, 'running', ?, ?)
  `).run(dealerId, backupId, listingId, sourceMobileId, now, now);
  return Number(result.lastInsertRowid);
}

function getPrimaryPubtype(techDataJson: string | null): string {
  if (!techDataJson) return '1';
  try {
    const parsed = JSON.parse(techDataJson) as Record<string, string>;
    const raw = parsed.pubtype || '1';
    return raw.split(',').map((part) => part.trim()).find(Boolean) || '1';
  } catch {
    return '1';
  }
}

function getRegionCityValues(techDataJson: string | null): { region: string | null; city: string | null } {
  if (!techDataJson) return { region: null, city: null };
  try {
    const parsed = JSON.parse(techDataJson) as Record<string, string>;
    return {
      region: parsed.region || null,
      city: parsed.city || null,
    };
  } catch {
    return { region: null, city: null };
  }
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

async function assertUploadInputAvailable(
  page: import('playwright').Page,
  repostDir: string,
  phase: string,
): Promise<void> {
  const selector = 'input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]';
  const input = page.locator(selector).first();
  if (await input.count() > 0) return;

  await fsp.mkdir(repostDir, { recursive: true });
  const screenshotPath = path.join(repostDir, `${phase}-missing-upload-input.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

  const pageText = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const message = pageText ? ` Mobile.bg page text: ${pageText.slice(0, 500)}` : '';
  throw new Error(`Mobile.bg did not show the image upload step after submitting the listing details.${message}`);
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

    const { region, city } = getRegionCityValues(backup.tech_data_json);
    const fieldOverrides = buildBackupFieldOverrides(backup);
    const dependentFields = [
      { name: 'f5', value: backup.make || '' },
      { name: 'f6', value: backup.model || '' },
      { name: 'f18', value: region || '' },
      { name: 'f19', value: city || '' },
    ].filter((field) => field.value);
    const editableFields = [
      { tag: 'input', type: 'text', name: 'f7', value: fieldOverrides.f7 ? String(fieldOverrides.f7) : '' },
      { tag: 'select', name: 'f8', value: fieldOverrides.f8 ? String(fieldOverrides.f8) : '' },
      { tag: 'input', type: 'text', name: 'f9', value: fieldOverrides.f9 != null ? String(fieldOverrides.f9) : '' },
      { tag: 'select', name: 'f29', value: fieldOverrides.f29 ? String(fieldOverrides.f29) : '' },
      { tag: 'select', name: 'f10', value: fieldOverrides.f10 ? String(fieldOverrides.f10) : '' },
      { tag: 'select', name: 'f11', value: fieldOverrides.f11 ? String(fieldOverrides.f11) : '' },
      { tag: 'input', type: 'text', name: 'f12', value: fieldOverrides.f12 != null ? String(fieldOverrides.f12) : '' },
      { tag: 'select', name: 'f13', value: fieldOverrides.f13 ? String(fieldOverrides.f13) : '' },
      { tag: 'select', name: 'f14', value: fieldOverrides.f14 ? String(fieldOverrides.f14) : '' },
      { tag: 'select', name: 'f15', value: fieldOverrides.f15 ? String(fieldOverrides.f15) : '' },
      { tag: 'input', type: 'text', name: 'f16', value: fieldOverrides.f16 != null ? String(fieldOverrides.f16) : '' },
      { tag: 'select', name: 'f17', value: fieldOverrides.f17 ? String(fieldOverrides.f17) : '' },
      { tag: 'textarea', type: 'textarea', name: 'f21', value: fieldOverrides.f21 ? String(fieldOverrides.f21) : '' },
      { tag: 'input', type: 'text', name: 'f22', value: fieldOverrides.f22 ? String(fieldOverrides.f22) : '' },
      { tag: 'input', type: 'text', name: 'f23', value: fieldOverrides.f23 ? String(fieldOverrides.f23) : '' },
      { tag: 'input', type: 'text', name: 'f24', value: fieldOverrides.f24 ? String(fieldOverrides.f24) : '' },
      { tag: 'select', name: 'f25', value: fieldOverrides.f25 ? String(fieldOverrides.f25) : '' },
      { tag: 'input', type: 'text', name: 'f30', value: fieldOverrides.f30 != null ? String(fieldOverrides.f30) : '' },
      { tag: 'select', name: 'f31', value: fieldOverrides.f31 ? String(fieldOverrides.f31) : '' },
      { tag: 'input', type: 'text', name: 'f32', value: fieldOverrides.f32 ? String(fieldOverrides.f32) : '' },
      { tag: 'input', type: 'text', name: 'f33', value: fieldOverrides.f33 ? String(fieldOverrides.f33) : '' },
      { tag: 'input', type: 'text', name: 'f34', value: fieldOverrides.f34 ? String(fieldOverrides.f34) : '' },
      { tag: 'input', type: 'checkbox', name: 'priceneg', value: fieldOverrides.priceneg ? String(fieldOverrides.priceneg) : '' },
    ].filter((field) => field.value);

    const pubtype = getPrimaryPubtype(backup.tech_data_json);
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

    if (images.length > 0) {
      await assertUploadInputAvailable(page, repostDir, 'draft-publish');
      const uploadInput = page.locator('input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]').first();
      for (const image of images) {
        const responsePromise = page.waitForResponse((response) => response.url().includes('upload.cgi'), { timeout: 30000 });
        await uploadInput.setInputFiles(image.local_path);
        await responsePromise;
        await page.waitForTimeout(300);
      }
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
    const resultText = (await page.textContent('body').catch(() => '')) || '';
    let targetMobileId =
      resultUrl.match(/obiava-(\d+)/)?.[1]
      || resultText.match(/Обява:\s*(\d{15,})/)?.[1]
      || resultText.match(/showPrintPDF\('?(\d{15,})'?/)?.[1]
      || null;

    if (!targetMobileId) {
      const viewButton = page.locator('a:has-text("Преглед на обявата")').first();
      if (await viewButton.count() > 0) {
        const href = await viewButton.getAttribute('href');
        targetMobileId = href?.match(/obiava-(\d+)/)?.[1] || targetMobileId;
        if (href) {
          resultUrl = href;
        }
      }
    }

    if (!targetMobileId) {
      throw new Error('Publish completed but no new listing ID was found');
    }

    const now = new Date().toISOString();
    let listingId = backup.listing_id ?? null;
    if (!listingId) {
      const insertListing = db.prepare(`
        INSERT INTO listings (
          mobile_id, dealer_id, url, title, make, model, reg_year,
          fuel, color, power, mileage, description, ad_status, kaparo, is_new,
          last_edit, current_price, vat, image_count, first_seen_at, last_seen_at, is_active, body_type, transmission
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `);
      const listingResult = insertListing.run(
        targetMobileId,
        dealer.id,
        resultUrl,
        backup.title || backup.source_title || '',
        backup.make,
        backup.model,
        backup.year ? String(backup.year) : null,
        backup.fuel,
        backup.color,
        backup.power,
        backup.mileage,
        backup.description,
        'none',
        0,
        now,
        backup.price_amount,
        normalizeVatValue(backup.vat_included),
        images.length,
        now,
        now,
        backup.category,
        backup.transmission,
      );
      listingId = Number(listingResult.lastInsertRowid);
    }

    db.prepare(`
      UPDATE mobilebg_backups
      SET
        listing_id = COALESCE(listing_id, ?),
        mobile_id = ?,
        source_url = ?,
        draft_needs_sync = 0,
        last_mobile_sync_status = 'success',
        last_mobile_sync_error = NULL,
        last_mobile_sync_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(listingId, targetMobileId, resultUrl, now, now, backup.id);

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
    `).run(errorMessage(error), repostDir, now, jobId);
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
    (JSON.parse(editSnapshot.checked_boxes_json || '[]') as Array<{ name: string; value: string }>).map(
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

    if (images.length > 0) {
      await assertUploadInputAvailable(page, repostDir, 'repost');
      const uploadInput = page.locator('input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]').first();
      for (const image of images) {
        const responsePromise = page.waitForResponse((response) => response.url().includes('upload.cgi'), { timeout: 30000 });
        await uploadInput.setInputFiles(image.local_path);
        await responsePromise;
        await page.waitForTimeout(300);
      }
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
    `).run(errorMessage(error), repostDir, now, jobId);
    throw error;
  } finally {
    await browser.close();
  }
}
