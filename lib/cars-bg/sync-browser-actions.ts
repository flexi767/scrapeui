import fs from 'fs';
import { type Page } from 'playwright';
import { CARS_BG_BASE_URL, prepareCarsBgPage } from '@/lib/cars-bg/auth';
import { firstLocatorValue, readCarsBgFormErrors, submitCarsBgForm } from '@/lib/cars-bg/form-submit';
import { fillCarsBgInput, fillCarsBgTextarea, selectCarsBgRadio } from '@/lib/cars-bg/form-fields';
import { downloadImages, uploadImages } from '@/lib/cars-bg/sync-images';
import { applyCarsBgSupplementalFields } from '@/lib/cars-bg/sync-extras';
import {
  buildCarsBgEditUrl,
  extractOfferId,
} from '@/lib/cars-bg/urls';
import {
  currencyIdFromCode,
  fetchModelOptions,
  findOptionByLabel,
  inferBrandFromTitle,
  inferModelFromTitle,
  mapCategory,
  mapColor,
  mapDoors,
  mapFuel,
  mapGear,
  normalizeCompareText,
  normalizeLabel,
  sanitizeCarsBgDescription,
  optionSets,
} from '@/lib/cars-bg/sync-mapping';
import {
  getCarsBgTitleValue,
  type CarsBgSyncListing,
} from '@/lib/cars-bg/sync-plan';

const fsp = fs.promises;

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
  await applyCarsBgSupplementalFields(page, listing, selectCarsBgRadio);

  await submitCarsBgForm(page);

  const errorText = await readCarsBgFormErrors(page);
  const persistedValue = await firstLocatorValue(priceInput);
  const bodyText = (await page.textContent('body').catch(() => '')) || '';
  const navigatedAway = !page.url().includes('editcar.php');
  return !errorText && (persistedValue === String(listing.price.amount) || bodyText.includes(String(listing.price.amount)) || navigatedAway);
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

  await applyCarsBgSupplementalFields(page, listing, selectCarsBgRadio);
  await submitCarsBgForm(page);

  const errorText = await readCarsBgFormErrors(page);
  const persistedTitle = await firstLocatorValue(titleInput);
  const persistedNotes = await firstLocatorValue(notesInput);
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

  await selectCarsBgRadio(page, 'stateId', 1);
  const condition = findOptionByLabel(optionSets.condition, 'В добро състояние');
  if (condition) await selectCarsBgRadio(page, 'conditionId', condition.id);
  await selectCarsBgRadio(page, 'brandId', brand.id);

  const modelOptions = await fetchModelOptions(brand.id);
  const model = inferModelFromTitle(listing.fullTitle, brand.label, modelOptions);
  if (model) {
    await page.evaluate((brandId) => {
      const toggle = (window as Window & { toggleModelSelect?: (id: string) => void }).toggleModelSelect;
      if (typeof toggle === 'function') toggle(String(brandId));
    }, brand.id).catch(() => {});
    await page.waitForSelector(`#modelId_${model.id}`, { timeout: 15000 }).catch(() => {});
    await selectCarsBgRadio(page, 'modelId', model.id);
  }

  const category = mapCategory(listing.category);
  if (category) await selectCarsBgRadio(page, 'categoryId', category.id);

  await fillCarsBgInput(page, '#engine', getCarsBgTitleValue(listing));
  await fillCarsBgInput(page, '#price', listing.price.amount);
  await selectCarsBgRadio(page, 'currencyId', currencyIdFromCode(listing.price.currency));

  const gear = mapGear(listing.transmission);
  if (gear) await selectCarsBgRadio(page, 'gearId', gear.id);

  const fuel = mapFuel(listing.fuel);
  if (fuel) await selectCarsBgRadio(page, 'fuelId', fuel.id);

  if (listing.power) await fillCarsBgInput(page, '#power', listing.power);
  if (listing.year) {
    await selectCarsBgRadio(page, 'production_year', listing.year);
    if (listing.month) {
      const monthNumber = Number.parseInt(listing.month, 10);
      await selectCarsBgRadio(page, 'monthId', Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= 12 ? monthNumber : 6);
    } else {
      await selectCarsBgRadio(page, 'monthId', 6);
    }
  }

  if (listing.mileage) await fillCarsBgInput(page, '#run', listing.mileage);
  await selectCarsBgRadio(page, 'doorId', mapDoors(listing.category));

  const color = mapColor(listing.color);
  if (color) await selectCarsBgRadio(page, 'colorId', color.id);

  await selectCarsBgRadio(page, 'is_inbg', 1);
  await fillCarsBgTextarea(page, '#notes', sanitizeCarsBgDescription(listing.description || listing.fullTitle));
  await applyCarsBgSupplementalFields(page, listing, selectCarsBgRadio);

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
