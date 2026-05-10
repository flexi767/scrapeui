import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { CARIMG_DIR } from '@/lib/storage-paths';
import { chromium, type Page } from 'playwright';
import { CARS_BG_BASE_URL, loginToCarsBg, prepareCarsBgPage } from '@/lib/cars-bg/auth';
import {
  buildCarsBgEditUrl,
  extractOfferId,
} from '@/lib/cars-bg/urls';
import { getCdnImageUrl, parseJson, type ImageMeta } from '@/lib/utils';
import { notDuplicateExpr } from '@/lib/query-modules/types';
import {
  type CarsBgExtrasPayload,
  normalizeLabel,
  normalizeCompareText,
  sanitizeCarsBgDescription,
  sanitizeCarsBgTitle,
  titleOverlapScore,
  normalizeFuelFamily,
  parseCarsBgExtrasPayload,
  getExtraLabels,
  optionSets,
  findOptionByLabel,
  fetchModelOptions,
  inferBrandFromTitle,
  inferModelFromTitle,
  mapCategory,
  mapGear,
  mapFuel,
  mapDoors,
  mapColor,
  currencyIdFromCode,
} from '@/lib/cars-bg/sync-mapping';
import { downloadImages, uploadImages } from '@/lib/cars-bg/sync-images';
import { applyCarsBgSupplementalFields } from '@/lib/cars-bg/sync-extras';

export { extractCarsBgExtras, applyCarsBgExtras } from '@/lib/cars-bg/sync-extras';

export {
  buildCarsBgEditUrl,
  buildCarsBgOfferUrl,
  extractMobileIdFromUrl,
  extractOfferId,
} from '@/lib/cars-bg/urls';

const fsp = fs.promises;
const LOCAL_IMAGE_BASE_DIR = CARIMG_DIR;

export interface CarsBgDealerAccount {
  id: number;
  slug: string;
  name: string | null;
  carsUrl: string | null;
  carsUser: string | null;
  carsPassword: string | null;
}

interface SyncListingRow {
  id: number;
  mobile_id: string | null;
  cars_id: string | null;
  dealer_id: number;
  url: string | null;
  title: string | null;
  carsbg_title: string | null;
  make: string | null;
  model: string | null;
  reg_month: string | null;
  reg_year: string | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  extras_json: string | null;
  ad_status: string | null;
  kaparo: number | null;
  current_price: number | null;
  vat: string | null;
  image_count: number | null;
  image_meta: string | null;
  full_keys: string | null;
  images_downloaded: number | null;
  latest_backup_id?: number | null;
}

export interface CarsBgSyncListing {
  id: number;
  mobileId: string | null;
  carsId: string | null;
  url: string;
  title: string;
  carsbgTitle: string | null;
  fullTitle: string;
  make: string | null;
  model: string | null;
  year: string | null;
  month: string | null;
  fuel: string | null;
  category: string | null;
  transmission: string | null;
  color: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  adStatus: string;
  kaparo: boolean;
  vat: string | null;
  price: { amount: number | null; currency: 'EUR' };
  images: string[];
  carsBgExtras: CarsBgExtrasPayload | null;
  extraLabels: string[];
}

interface CarsBgDiff {
  mobileBg: CarsBgSyncListing;
  carsBg: CarsBgSyncListing;
  priceDiff: boolean;
  titleDiff: boolean;
  descriptionDiff: boolean;
}

interface CarsBgSyncPlan {
  missing: CarsBgSyncListing[];
  diffs: CarsBgDiff[];
  staleCarsIds: string[];
}

export interface CarsBgSyncDealerResult extends CarsBgSyncPlan {
  updated: number;
  created: number;
  deleted: number;
  failedUpdates: number;
  failedCreates: number;
  failedDeletes: number;
  dryRun: boolean;
}

export function saveCarsId(db: Database.Database, mobileId: string, carsId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE listings SET cars_id = ?, cars_synced_at = ? WHERE mobile_id = ?').run(carsId, now, mobileId);
}

export function clearCarsId(db: Database.Database, carsId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE listings SET cars_id = NULL, cars_synced_at = ? WHERE cars_id = ?').run(now, carsId);
}

// Persist the content we just pushed to cars.bg back onto the `source='c'`
// listings row so the next diff cycle sees the up-to-date title/description
// instead of re-flagging them. `listingId` is the cars.bg row id, not the
// cars_id hex.
export function applyCarsBgSyncedContent(
  db: Database.Database,
  listingId: number,
  content: { title?: string | null; description?: string | null; price?: number | null },
): void {
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (content.price !== undefined) {
    assignments.push('current_price = ?');
    values.push(content.price ?? null);
  }
  if (content.title !== undefined) {
    assignments.push('carsbg_title = ?');
    values.push(content.title ?? null);
  }
  if (content.description !== undefined) {
    assignments.push('description = ?');
    values.push(content.description ?? null);
  }
  if (!assignments.length) return;
  values.push(listingId);
  db.prepare(`UPDATE listings SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
}

export function getStaleCarsBgListings(db: Database.Database, dealerSlug: string): string[] {
  const rows = db.prepare(`
    SELECT l.cars_id
    FROM listings l
    JOIN dealers d ON d.id = l.dealer_id
    WHERE d.slug = ?
      AND l.source = 'm'
      AND l.is_active = 0
      AND l.cars_id IS NOT NULL
  `).all(dealerSlug) as { cars_id: string }[];
  return rows.map((row) => row.cars_id).filter(Boolean);
}

async function selectRadio(page: Page, name: string, value: number | string | null | undefined): Promise<void> {
  if (value == null) return;
  await page.evaluate(({ field, fieldValue }) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(`input[name="${field}"][value="${fieldValue}"]`);
    inputs.forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, { field: name, fieldValue: String(value) });
}

async function fillInput(page: Page, selector: string, value: string | number | null | undefined): Promise<void> {
  if (value == null || value === '') return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value), { delay: 10 });
}

async function fillTextarea(page: Page, selector: string, value: string | null | undefined): Promise<void> {
  if (!value) return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value).slice(0, 32000), { delay: 5 });
}


function getBackupOrderedImages(db: Database.Database, backupId: number | null | undefined): string[] {
  if (!backupId) return [];
  const rows = db.prepare(`
    SELECT local_path, source_url
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backupId) as Array<{ local_path: string | null; source_url: string | null }>;

  return rows
    .map((row) => {
      if (row.local_path && fs.existsSync(row.local_path)) return row.local_path;
      return row.source_url;
    })
    .filter((value): value is string => Boolean(value));
}

function parseListingImageSources(db: Database.Database, row: SyncListingRow): string[] {
  const backupOrdered = getBackupOrderedImages(db, row.latest_backup_id);
  if (backupOrdered.length) return backupOrdered;

  const fullKeys = parseJson<string[]>(row.full_keys, []);
  if (!fullKeys.length || !row.mobile_id) return [];

  if (fullKeys[0]?.startsWith('http')) return fullKeys;

  if (row.images_downloaded === 1) {
    const local: string[] = [];
    for (let i = 0; i < fullKeys.length; i++) {
      const filename = `${String(i + 1).padStart(2, '0')}.webp`;
      const filePath = path.join(LOCAL_IMAGE_BASE_DIR, row.mobile_id, 'full', filename);
      if (fs.existsSync(filePath)) local.push(filePath);
    }
    if (local.length) return local;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  if (!imageMeta) return [];
  return fullKeys.map((key) => getCdnImageUrl(row.mobile_id!, key, imageMeta, 'full'));
}

function makeFullTitle(row: SyncListingRow): string {
  return [row.make, row.model, row.title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function mapRowToSyncListing(db: Database.Database, row: SyncListingRow): CarsBgSyncListing {
  const title = row.title || '';
  return {
    id: row.id,
    mobileId: row.mobile_id,
    carsId: row.cars_id,
    url: row.url || '',
    title,
    carsbgTitle: row.carsbg_title || null,
    fullTitle: makeFullTitle(row) || title,
    make: row.make,
    model: row.model,
    year: row.reg_year,
    month: row.reg_month,
    fuel: row.fuel,
    category: row.body_type,
    transmission: row.transmission,
    color: row.color,
    euronorm: row.euronorm,
    power: row.power,
    mileage: row.mileage,
    description: row.description,
    adStatus: row.ad_status || 'none',
    kaparo: row.kaparo === 1,
    vat: row.vat,
    price: { amount: row.current_price, currency: 'EUR' },
    images: parseListingImageSources(db, row),
    carsBgExtras: parseCarsBgExtrasPayload(row.extras_json),
    extraLabels: getExtraLabels(row.extras_json),
  };
}

function loadDealerMobileListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, euronorm, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded,
      (
        SELECT b.id
        FROM mobilebg_backups b
        WHERE b.listing_id = listings.id
        ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        LIMIT 1
      ) as latest_backup_id
    FROM listings
    WHERE dealer_id = ?
      AND source = 'm'
      AND is_active = 1
      AND ${notDuplicateExpr}
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

function loadDealerCarsListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, euronorm, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded
    FROM listings
    WHERE dealer_id = ?
      AND source = 'c'
      AND is_active = 1
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

function compareListings(mobile: CarsBgSyncListing[], cars: CarsBgSyncListing[]): CarsBgSyncPlan {
  const missing: CarsBgSyncListing[] = [];
  const diffs: CarsBgDiff[] = [];
  const matchedCars = new Set<number>();
  const carsById = new Map(cars.filter((entry) => entry.carsId).map((entry) => [entry.carsId!, entry]));

  for (const mobileListing of mobile) {
    let match: CarsBgSyncListing | null = null;

    if (mobileListing.carsId) {
      match = carsById.get(mobileListing.carsId) ?? null;
      if (match) {
        matchedCars.add(match.id);
      } else {
        // The offer is already linked to a cars.bg id, but we don't have the
        // corresponding `source='c'` crawl row locally yet. Treat it as already
        // published instead of planning a duplicate create against stale local
        // data.
        continue;
      }
    }

    if (!match) {
      let best: { listing: CarsBgSyncListing; score: number } | null = null;

      for (const carsListing of cars) {
        if (matchedCars.has(carsListing.id)) continue;

        let score = 0;
        const mobileMake = normalizeLabel(mobileListing.make || '');
        const carsMake = normalizeLabel(carsListing.make || '');
        const mobileModel = normalizeLabel(mobileListing.model || '');
        const carsModel = normalizeLabel(carsListing.model || '');
        const carsFull = normalizeLabel(carsListing.fullTitle);
        const mobileFull = normalizeLabel(mobileListing.fullTitle);

        if (mobileMake && carsMake) {
          if (mobileMake === carsMake) score += 2;
          else if (carsFull.includes(mobileMake) || mobileFull.includes(carsMake)) score += 1;
          else score -= 2;
        }

        if (mobileModel && carsModel) {
          if (mobileModel === carsModel) score += 2;
          else if (carsFull.includes(mobileModel) || mobileFull.includes(carsModel)) score += 1;
          else score -= 3;
        }

        if (mobileListing.price.amount != null && carsListing.price.amount != null) {
          if (Number(mobileListing.price.amount) === Number(carsListing.price.amount)) score += 2;
          else {
            const priceDiff = Math.abs(Number(mobileListing.price.amount) - Number(carsListing.price.amount));
            if (priceDiff <= 500) score += 1;
          }
        }

        if (mobileListing.year && carsListing.year) {
          if (mobileListing.year === carsListing.year) score += 2;
          else continue;
        }

        if (mobileListing.mileage != null && carsListing.mileage != null) {
          const diff = Math.abs(Number(mobileListing.mileage) - Number(carsListing.mileage));
          if (diff === 0) score += 3;
          else if (diff <= 1000) score += 2;
          else if (diff <= 5000) score += 1;
          else continue;
        }

        if (mobileListing.fuel && carsListing.fuel) {
          const mobileFuelFamily = normalizeFuelFamily(mobileListing.fuel);
          const carsFuelFamily = normalizeFuelFamily(carsListing.fuel);
          if (mobileFuelFamily && carsFuelFamily && mobileFuelFamily === carsFuelFamily) score += 1;
          else continue;
        }

        if (mobileListing.category && carsListing.category) {
          if (mobileListing.category === carsListing.category) score += 1;
        }

        score += Math.min(1, titleOverlapScore(mobileListing.fullTitle, carsListing.fullTitle));

        if (!best || score > best.score) best = { listing: carsListing, score };
      }

      if (best && best.score >= 4) {
        match = best.listing;
        matchedCars.add(match.id);
      }
    }

    if (!match) {
      missing.push(mobileListing);
      continue;
    }

    const priceDiff = mobileListing.price.amount != null
      && match.price.amount != null
      && Number(mobileListing.price.amount) !== Number(match.price.amount);
    const targetTitle = getCarsBgTitleValue(mobileListing);
    const currentCarsTitle = getCarsBgTitleValue(match);
    const titleDiff = Boolean(
      targetTitle &&
      normalizeLabel(targetTitle) !== normalizeLabel(currentCarsTitle),
    );
    const targetDescription = normalizeCompareText(mobileListing.description);
    const currentDescription = normalizeCompareText(match.description);
    // Only flag a diff when both sides have a description. If the cars.bg side
    // was never deep-crawled the field is empty and comparing would mark every
    // listing as needing sync.
    const descriptionDiff = Boolean(
      targetDescription &&
      currentDescription &&
      targetDescription !== currentDescription,
    );

    if (priceDiff || titleDiff || descriptionDiff) {
      diffs.push({ mobileBg: mobileListing, carsBg: match, priceDiff, titleDiff, descriptionDiff });
    }
  }

  return {
    missing,
    diffs,
    staleCarsIds: [],
  };
}

export async function deleteCarsBgOffer(page: Page, offerId: string): Promise<boolean> {
  await page.goto(`${CARS_BG_BASE_URL}/delete_offer.php?id=${offerId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const confirmButton = await page.$('button[type="submit"], input[type="submit"], a[data-action*="delete"], a[href*="confirm"]').catch(() => null);
  if (confirmButton) {
    await confirmButton.click().catch(() => {});
    await page.waitForTimeout(1500);
    return true;
  }
  await page.evaluate(async ({ offer, baseUrl }) => {
    await fetch(`${baseUrl}/delete_offer.php?id=${offer}&confirm=1`, {
      method: 'POST',
      credentials: 'include',
    });
  }, { offer: offerId, baseUrl: CARS_BG_BASE_URL }).catch(() => {});
  const bodyText = (await page.textContent('body').catch(() => '')) || '';
  return bodyText.includes('изтрита') || bodyText.includes('deleted') || bodyText.includes('успешно');
}

export async function updateListingPrice(page: Page, offerUrlOrId: string, listing: CarsBgSyncListing): Promise<boolean> {
  const offerId = extractOfferId(offerUrlOrId);
  if (!offerId) return false;

  await page.goto(buildCarsBgEditUrl(offerId), { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const priceInput = page.locator('input[name="price"], input[name*="price"], input[id*="price"]').first();
  if (!(await priceInput.count())) return false;

  await priceInput.fill('');
  await priceInput.type(String(listing.price.amount), { delay: 20 });
  await applyCarsBgSupplementalFields(page, listing, selectRadio);

  const submitSelectors = [
    '#publishBtn',
    'button[type="submit"]',
    'input[type="submit"]',
    'a.btn-thick',
    'button:has-text("Запази")',
    'button:has-text("Промени")',
  ];

  let clicked = false;
  for (const selector of submitSelectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    await page.locator('form').first().evaluate((form) => (form as HTMLFormElement).submit()).catch(() => {});
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const errorText = await page.$$eval('.error', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).join(' | ')).catch(() => '');
  const persistedValue = await priceInput.inputValue().catch(() => '');
  const bodyText = (await page.textContent('body').catch(() => '')) || '';
  const navigatedAway = !page.url().includes('editcar.php');
  return !errorText && (persistedValue === String(listing.price.amount) || bodyText.includes(String(listing.price.amount)) || navigatedAway);
}

function getCarsBgTitleValue(listing: CarsBgSyncListing): string {
  return sanitizeCarsBgTitle(listing.carsbgTitle || listing.title || listing.fullTitle || '');
}

export async function updateListingContent(page: Page, offerUrlOrId: string, listing: CarsBgSyncListing): Promise<boolean> {
  const offerId = extractOfferId(offerUrlOrId);
  if (!offerId) return false;

  await page.goto(buildCarsBgEditUrl(offerId), { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const targetTitle = getCarsBgTitleValue(listing);
  const notes = sanitizeCarsBgDescription(listing.description || listing.fullTitle);

  const titleInput = page.locator('#engine, input[name="engine"], input[id*="engine"]').first();
  if (targetTitle && await titleInput.count()) {
    await titleInput.fill('');
    await titleInput.type(targetTitle, { delay: 20 });
  }

  const notesInput = page.locator('#notes, textarea[name="notes"], textarea[id*="notes"]').first();
  if (notes && await notesInput.count()) {
    await notesInput.fill('');
    await notesInput.type(notes.slice(0, 32000), { delay: 5 });
  }

  await applyCarsBgSupplementalFields(page, listing, selectRadio);

  const submitSelectors = [
    '#publishBtn',
    'button[type="submit"]',
    'input[type="submit"]',
    'a.btn-thick',
    'button:has-text("Запази")',
    'button:has-text("Промени")',
  ];

  let clicked = false;
  for (const selector of submitSelectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    await page.locator('form').first().evaluate((form) => (form as HTMLFormElement).submit()).catch(() => {});
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const errorText = await page.$$eval('.error', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).join(' | ')).catch(() => '');
  const persistedTitle = await titleInput.inputValue().catch(() => '');
  const persistedNotes = await notesInput.inputValue().catch(() => '');
  const bodyText = (await page.textContent('body').catch(() => '')) || '';
  const navigatedAway = !page.url().includes('editcar.php');

  return !errorText && (
    navigatedAway ||
    (targetTitle ? normalizeLabel(persistedTitle) === normalizeLabel(targetTitle) : true) &&
    (notes ? normalizeCompareText(persistedNotes).includes(normalizeCompareText(notes).slice(0, 32)) || normalizeCompareText(bodyText).includes(normalizeCompareText(notes).slice(0, 32)) : true)
  );
}

export async function createListing(page: Page, listing: CarsBgSyncListing, dealerSlug: string): Promise<{ success: boolean; url?: string; offerId?: string | null }> {
  if (!optionSets) return { success: false };
  if (!listing.price.amount) return { success: false };

  await page.goto(`${CARS_BG_BASE_URL}/publishcar.php?fromothersection=1`, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const brand = inferBrandFromTitle(listing.fullTitle);
  if (!brand) return { success: false };

  await selectRadio(page, 'stateId', 1);
  const condition = findOptionByLabel(optionSets.condition, 'В добро състояние');
  if (condition) await selectRadio(page, 'conditionId', condition.id);
  await selectRadio(page, 'brandId', brand.id);

  const modelOptions = await fetchModelOptions(brand.id);
  const model = inferModelFromTitle(listing.fullTitle, brand.label, modelOptions);
  if (model) {
    await page.evaluate((brandId) => {
      const toggle = (window as Window & { toggleModelSelect?: (id: string) => void }).toggleModelSelect;
      if (typeof toggle === 'function') toggle(String(brandId));
    }, brand.id).catch(() => {});
    await page.waitForSelector(`#modelId_${model.id}`, { timeout: 15000 }).catch(() => {});
    await selectRadio(page, 'modelId', model.id);
  }

  const category = mapCategory(listing.category);
  if (category) await selectRadio(page, 'categoryId', category.id);

  await fillInput(page, '#engine', getCarsBgTitleValue(listing));
  await fillInput(page, '#price', listing.price.amount);
  await selectRadio(page, 'currencyId', currencyIdFromCode(listing.price.currency));

  const gear = mapGear(listing.transmission);
  if (gear) await selectRadio(page, 'gearId', gear.id);

  const fuel = mapFuel(listing.fuel);
  if (fuel) await selectRadio(page, 'fuelId', fuel.id);

  if (listing.power) await fillInput(page, '#power', listing.power);
  if (listing.year) {
    await selectRadio(page, 'production_year', listing.year);
    if (listing.month) {
      const monthNumber = Number.parseInt(listing.month, 10);
      if (Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
        await selectRadio(page, 'monthId', monthNumber);
      } else {
        await selectRadio(page, 'monthId', 6);
      }
    } else {
      await selectRadio(page, 'monthId', 6);
    }
  }

  if (listing.mileage) await fillInput(page, '#run', listing.mileage);
  await selectRadio(page, 'doorId', mapDoors(listing.category));

  const color = mapColor(listing.color);
  if (color) await selectRadio(page, 'colorId', color.id);

  await selectRadio(page, 'is_inbg', 1);
  await fillTextarea(page, '#notes', sanitizeCarsBgDescription(listing.description || listing.fullTitle));
  await applyCarsBgSupplementalFields(page, listing, selectRadio);

  let tempDir: string | null = null;
  try {
    const { dir, files } = await downloadImages(listing.images || [], `${dealerSlug}-${Date.now()}`);
    tempDir = dir;
    if (files.length) await uploadImages(page, files);
  } finally {
    if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(500);
  await page.click('#publishBtn').catch(() => {});

  let success = false;
  try {
    await page.waitForFunction(() => window.location.href.includes('/offer/'), { timeout: 45000 });
    success = true;
  } catch {
    success = false;
  }

  const finalUrl = page.url();
  return success ? { success: true, url: finalUrl, offerId: extractOfferId(finalUrl) } : { success: false };
}

export async function planCarsBgDealerSync(db: Database.Database, dealer: CarsBgDealerAccount): Promise<CarsBgSyncPlan> {
  const mobileListings = loadDealerMobileListings(db, dealer.id);
  const carsListings = loadDealerCarsListings(db, dealer.id);
  const plan = compareListings(mobileListings, carsListings);
  plan.staleCarsIds = getStaleCarsBgListings(db, dealer.slug);
  return plan;
}

export async function syncCarsBgDealer(
  db: Database.Database,
  dealer: CarsBgDealerAccount,
  options?: {
    dryRun?: boolean;
    logger?: (message: string) => void;
  },
): Promise<CarsBgSyncDealerResult> {
  const logger = options?.logger ?? (() => {});
  const plan = await planCarsBgDealerSync(db, dealer);

  logger(`Cars.bg sync plan for ${dealer.slug}: ${plan.missing.length} missing, ${plan.diffs.length} diffs, ${plan.staleCarsIds.length} stale`);

  const result: CarsBgSyncDealerResult = {
    ...plan,
    updated: 0,
    created: 0,
    deleted: 0,
    failedUpdates: 0,
    failedCreates: 0,
    failedDeletes: 0,
    dryRun: options?.dryRun !== false,
  };

  if (result.dryRun || (!plan.missing.length && !plan.diffs.length && !plan.staleCarsIds.length)) {
    return result;
  }

  if (!dealer.carsUser || !dealer.carsPassword) {
    throw new Error(`Dealer ${dealer.slug} is missing cars.bg credentials`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const loggedIn = await loginToCarsBg(page, dealer.carsUser, dealer.carsPassword);
    if (!loggedIn) throw new Error(`Cars.bg login failed for ${dealer.slug}`);

    for (const diff of plan.diffs) {
      const targetId = diff.mobileBg.carsId || diff.carsBg.carsId || extractOfferId(diff.carsBg.url);
      if (!targetId) {
        result.failedUpdates++;
        continue;
      }
      const updateParts: string[] = [];
      let ok = true;
      if (diff.priceDiff && diff.mobileBg.price.amount != null) {
        updateParts.push(`price €${diff.carsBg.price.amount ?? '—'} -> €${diff.mobileBg.price.amount}`);
        ok = ok && await updateListingPrice(page, targetId, diff.mobileBg);
      }
      let contentUpdated = false;
      if (diff.titleDiff || diff.descriptionDiff) {
        const changedFields = [
          diff.titleDiff ? 'title' : null,
          diff.descriptionDiff ? 'description' : null,
        ].filter(Boolean).join('/');
        updateParts.push(changedFields);
        contentUpdated = await updateListingContent(page, targetId, diff.mobileBg);
        ok = ok && contentUpdated;
      }
      logger(`Updating cars.bg ${updateParts.join(', ')} for ${diff.mobileBg.fullTitle}`);
      if (ok) {
        result.updated++;
      } else {
        result.failedUpdates++;
      }
      if (!diff.mobileBg.carsId && targetId && diff.mobileBg.mobileId) {
        saveCarsId(db, diff.mobileBg.mobileId, targetId);
      }
      if (diff.priceDiff) {
        applyCarsBgSyncedContent(db, diff.carsBg.id, {
          price: diff.mobileBg.price.amount ?? null,
        });
      }
      if (contentUpdated) {
        // Mirror what we just pushed to cars.bg onto the local `source='c'`
        // row so the next planCarsBgDealerSync run doesn't re-detect the same
        // diff. updateListingContent pushes the mobile.bg carsbg_title and the
        // mobile.bg description (sanitized).
        applyCarsBgSyncedContent(db, diff.carsBg.id, {
          title: diff.titleDiff ? (getCarsBgTitleValue(diff.mobileBg) || null) : undefined,
          description: diff.descriptionDiff
            ? (sanitizeCarsBgDescription(diff.mobileBg.description || diff.mobileBg.fullTitle) || null)
            : undefined,
        });
      }
    }

    for (const carsId of plan.staleCarsIds) {
      logger(`Deleting stale cars.bg offer ${carsId}`);
      const deleted = await deleteCarsBgOffer(page, carsId);
      if (deleted) {
        clearCarsId(db, carsId);
        result.deleted++;
      } else {
        result.failedDeletes++;
      }
    }

    for (const listing of plan.missing) {
      logger(`Publishing missing cars.bg listing ${listing.fullTitle}`);
      const created = await createListing(page, listing, dealer.slug);
      if (created.success && created.offerId && listing.mobileId) {
        saveCarsId(db, listing.mobileId, created.offerId);
        result.created++;
      } else {
        result.failedCreates++;
      }
    }
  } finally {
    await browser.close();
  }

  return result;
}
