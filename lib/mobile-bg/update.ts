import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { currentIsoTimestamp } from '@/lib/date-format';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { DealerBackupConfig, USER_AGENT } from '@/lib/mobile-bg/constants';
import { applyCapturedMobileBgDraft, buildBackupFieldOverrides, selectMobileBgDependentFields } from '@/lib/mobile-bg/draft';
import { captureEditFormSnapshot, submitMyAdsEditForm } from '@/lib/mobile-bg/edit-form';
import { SCRAPED_ROOT } from '@/lib/storage-paths';
import { markSyncFailed, markSyncRunning } from '@/lib/mobile-bg/sync-status';
import { errorMessage, parseJson } from '@/lib/utils';

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
  body_type: string | null;
  description: string | null;
  ad_status: string | null;
  tech_data_json: string | null;
}

interface EditSnapshotRow {
  id: number;
  listing_token: string | null;
  source_url: string | null;
  fields_json: string | null;
  checked_boxes_json: string | null;
}

interface UpdateBackupOptions {
  log?: (message: string) => void;
  session?: MobileBgUpdateSession;
}

export interface MobileBgUpdateSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  dealerSlug: string;
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

function getUpdateDir(dealerSlug: string, backupId: number): string {
  return path.join(SCRAPED_ROOT, dealerSlug, 'updates', String(backupId));
}

function normalizePromoStatus(value: string | null | undefined): 'TOP' | 'VIP' | 'none' {
  const normalized = (value || '').trim().toUpperCase();
  if (normalized === 'TOP' || normalized === 'BEST') return 'TOP';
  if (normalized === 'VIP') return 'VIP';
  return 'none';
}

async function gotoMyAds(page: import('playwright').Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await acceptMobileBgCookies(page);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1000);
    }
  }
}

export async function createMobileBgUpdateSession(
  dealer: DealerBackupConfig,
  log: (message: string) => void = () => {},
): Promise<MobileBgUpdateSession> {
  log('Launching browser session…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    log(`Logging into mobile.bg as ${dealer.slug}…`);
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    return {
      browser,
      context,
      page,
      dealerSlug: dealer.slug,
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

export async function closeMobileBgUpdateSession(session: MobileBgUpdateSession): Promise<void> {
  await session.browser.close();
}

async function readMyAdsPromoState(
  page: import('playwright').Page,
  mobileId: string,
): Promise<{ status: 'TOP' | 'VIP' | 'none'; vipDisabled: boolean }> {
  return page.evaluate((targetId) => {
    const statusText = document.querySelector(`#status_info_${targetId}`)?.textContent || '';
    const vipButton = document.querySelector(`#make_vip_${targetId}`) as HTMLElement | null;
    const vipDisabled = vipButton?.classList.contains('disabled') || false;
    const normalized = /ТОП|BEST/i.test(statusText)
      ? 'TOP'
      : /VIP/i.test(statusText)
      ? 'VIP'
      : 'none';
    return { status: normalized, vipDisabled };
  }, mobileId);
}

async function promoteListingStatusOnMyAds(
  page: import('playwright').Page,
  mobileId: string,
  desiredStatus: 'TOP' | 'VIP' | 'none',
  log: (message: string) => void,
): Promise<'TOP' | 'VIP' | 'none'> {
  await gotoMyAds(page);

  const current = await readMyAdsPromoState(page, mobileId);
  if (desiredStatus === 'none') {
    if (current.status !== 'none') {
      log(`Listing #${mobileId} is already ${current.status}. mobile.bg does not allow downgrading paid status during the active period.`);
    }
    return current.status;
  }

  if (current.status === desiredStatus) {
    log(`Listing #${mobileId} is already ${desiredStatus}.`);
    return current.status;
  }

  if (desiredStatus === 'VIP' && (current.status === 'TOP' || current.vipDisabled)) {
    log(`Listing #${mobileId} is already TOP/BEST, so mobile.bg will not allow a VIP change.`);
    return 'TOP';
  }

  const triggerSelector = desiredStatus === 'TOP'
    ? `#make_top_${mobileId}`
    : `#make_vip_${mobileId}`;

  log(`Applying ${desiredStatus} status for one week on mobile.bg…`);
  await page.click(triggerSelector, { force: true });
  await page.waitForTimeout(600);

  const promoSelect = page.locator('#sidebar-promotirane-select');
  if (await promoSelect.count() > 0) {
    const optionValues = await promoSelect.locator('option').evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        text: option.textContent?.trim() || '',
      })),
    ).catch(() => []);

    const statusPattern = desiredStatus === 'TOP'
      ? /ТОП|TOP|BEST/i
      : /VIP/i;
    const weekOption =
      optionValues.find((option) => statusPattern.test(option.text) && /1\s*седмиц|една\s*седмиц|1\s*week/i.test(option.text)) ||
      optionValues.find((option) => statusPattern.test(option.text)) ||
      optionValues.find((option) => /1\s*седмиц|една\s*седмиц|1\s*week/i.test(option.text)) ||
      optionValues[0];

    if (weekOption?.value) {
      await promoSelect.selectOption(weekOption.value).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  await page.click('#vip-confirm-btn', { force: true });
  await page.waitForTimeout(600);

  const popupConfirm = page.locator('#popup-lite-vip-confirm-btn');
  if (await popupConfirm.count() > 0) {
    const popupVisible = await popupConfirm.evaluate((element) => {
      const popup = element.closest('.popup-lite') as HTMLElement | null;
      if (!popup) return false;
      const style = window.getComputedStyle(popup);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).catch(() => false);

    if (popupVisible) {
      await popupConfirm.click({ force: true });
      await page.waitForTimeout(800);
    }
  }

  await page.waitForFunction(
    ({ targetId, targetStatus }) => {
      const text = document.querySelector(`#status_info_${targetId}`)?.textContent || '';
      if (targetStatus === 'TOP') return /ТОП|BEST/i.test(text);
      if (targetStatus === 'VIP') return /VIP/i.test(text);
      return !/ТОП|BEST|VIP/i.test(text);
    },
    { targetId: mobileId, targetStatus: desiredStatus },
    { timeout: 20000 },
  ).catch(() => {});

  const finalState = await readMyAdsPromoState(page, mobileId);
  log(`mobile.bg paid status is now ${finalState.status}.`);
  return finalState.status;
}

export async function updateBackupOnMobileBg(
  db: Database.Database,
  dealer: DealerBackupConfig,
  backupId: number,
  options?: UpdateBackupOptions,
): Promise<{ mobileId: string }> {
  const log = options?.log ?? (() => {});
  const sharedSession = options?.session;
  const backup = db.prepare(`
    SELECT
      b.id,
      b.listing_id,
      b.mobile_id,
      COALESCE(b.title, l.title) as title,
      b.source_title,
      COALESCE(b.price_amount, l.current_price) as price_amount,
      CASE
        WHEN b.vat_included IS NOT NULL THEN b.vat_included
        WHEN l.vat = 'included' THEN 'yes'
        WHEN l.vat = 'excluded' THEN 'no'
        WHEN l.vat = 'exempt' THEN 'no'
        ELSE NULL
      END as vat_included,
      COALESCE(b.mileage, l.mileage) as mileage,
      COALESCE(b.fuel, l.fuel) as fuel,
      COALESCE(b.power, l.power) as power,
      COALESCE(b.engine, l.carsbg_title) as engine,
      COALESCE(b.color, l.color) as color,
      COALESCE(b.transmission, l.transmission) as transmission,
      COALESCE(b.category, l.body_type) as body_type,
      COALESCE(b.description, l.description) as description,
      COALESCE(b.ad_status, l.ad_status) as ad_status,
      b.tech_data_json
    FROM mobilebg_backups b
    LEFT JOIN listings l ON l.id = b.listing_id
    WHERE b.id = ?
  `).get(backupId) as BackupRow | undefined;

  if (!backup?.mobile_id) {
    throw new Error(`Backup ${backupId} not found or missing mobile ID`);
  }

  log(`Preparing sync for mobile.bg #${backup.mobile_id}`);
  let editSnapshot = getLatestEditSnapshot(db, backupId, backup.mobile_id);

  if (!editSnapshot?.listing_token || !editSnapshot.fields_json) {
    log('No saved edit snapshot found. Capturing one first…');
    await captureEditFormSnapshot(db, dealer, backup.mobile_id);
    editSnapshot = getLatestEditSnapshot(db, backupId, backup.mobile_id);
  }

  if (!editSnapshot?.listing_token || !editSnapshot.fields_json) {
    throw new Error(`No edit form snapshot found for backup ${backupId} after auto-capture`);
  }

  const fields = JSON.parse(editSnapshot.fields_json) as Array<Record<string, unknown>>;
  const checkedBoxes = parseJson<Array<{ name: string; value: string }>>(editSnapshot.checked_boxes_json, [])
    .map((x) => `${x.name}::${x.value}`);
  const fieldOverrides = buildBackupFieldOverrides(backup);
  const ownedSession = sharedSession ?? await createMobileBgUpdateSession(dealer, log);
  const page = ownedSession.page;
  const updateDir = getUpdateDir(dealer.slug, backupId);
  await fsp.mkdir(updateDir, { recursive: true });
  markSyncRunning(db, backup.id);

  try {
    if (sharedSession && sharedSession.dealerSlug !== dealer.slug) {
      throw new Error(`Shared mobile.bg session dealer mismatch: expected ${dealer.slug}, got ${sharedSession.dealerSlug}`);
    }

    log('Opening listing edit form…');
    await page.goto(
      editSnapshot.source_url || 'https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23',
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForTimeout(1500);
    await acceptMobileBgCookies(page);

    log('Loading the saved listing draft…');
    await submitMyAdsEditForm(page, backup.mobile_id, editSnapshot.listing_token);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1800);
    await acceptMobileBgCookies(page);

    log('Reapplying dependent fields and saved values…');
    await selectMobileBgDependentFields(page, fields);
    await applyCapturedMobileBgDraft(page, fields, checkedBoxes, fieldOverrides);

    const beforeSubmitPath = path.join(updateDir, 'before-submit.png');
    log('Captured pre-submit screenshot.');
    await page.screenshot({ path: beforeSubmitPath, fullPage: true });

    await acceptMobileBgCookies(page);
    const submitButton = page.locator('#pubButton, input[type="submit"], a.pubButton').first();
    if (await submitButton.count() === 0) {
      throw new Error('Could not find mobile.bg save button');
    }

    log('Submitting updated listing to mobile.bg…');
    await submitButton.click({ force: true });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    await acceptMobileBgCookies(page);

    const afterSubmitPath = path.join(updateDir, 'after-submit.png');
    log('Captured post-submit screenshot.');
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

    const effectiveAdStatus = backup.mobile_id
      ? await promoteListingStatusOnMyAds(page, backup.mobile_id, normalizePromoStatus(backup.ad_status), log)
      : normalizePromoStatus(backup.ad_status);

    const now = currentIsoTimestamp();
    db.prepare(`
      UPDATE mobilebg_backups
      SET
        draft_needs_sync = 0,
        ad_status = ?,
        last_mobile_sync_status = 'success',
        last_mobile_sync_error = NULL,
        last_mobile_sync_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(effectiveAdStatus, now, now, backup.id);

    if (backup.listing_id != null) {
      db.prepare(`
        UPDATE listings
        SET ad_status = ?
        WHERE id = ?
      `).run(effectiveAdStatus, backup.listing_id);
    }

    log(`Sync finished successfully for mobile.bg #${backup.mobile_id}`);
    return { mobileId: backup.mobile_id };
  } catch (error) {
    const debugPath = path.join(updateDir, 'error.png');
    await page.screenshot({ path: debugPath, fullPage: true }).catch(() => {});
    log(`Sync failed: ${errorMessage(error)}`);
    markSyncFailed(db, backup.id, error);
    throw error;
  } finally {
    if (!sharedSession) {
      await closeMobileBgUpdateSession(ownedSession);
    }
  }
}
