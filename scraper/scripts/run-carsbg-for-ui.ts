#!/usr/bin/env tsx
/**
 * Cars.bg scraper runner for the scrapeui web interface.
 * Emits newline-delimited JSON to stdout for SSE streaming.
 *
 * Usage: tsx scripts/run-carsbg-for-ui.ts --dealers carbros,mmotors [--deep]
 *
 * Cars.bg page structure:
 *   - List page loads dynamically via Scrollable into #listContainer
 *   - Each card is an <a href="/company/SLUG/offer/HEX_ID"> containing:
 *       <h6> date line (e.g. "15.03.26, нов внос")
 *       <h6> price line (e.g. "38,500 EUR / 75,299.46 BGN")
 *       <h5> title (e.g. "Audi A8 Long S-Line")
 *       <p>  specs (e.g. "2019, Дизел, 219000 км.")
 *       <p>  description snippet
 *   - Offer IDs are hex strings (MongoDB ObjectId), NOT numeric
 *   - Detail page specs: comma-separated string like
 *       "Януари 2019, Седан, ..., Дизел, 219 000км, Автоматични скорости, 286к.с., 4/5 врати, Тъмно син металик"
 *   - Images hosted on g1-bg.cars.bg (not www.cars.bg)
 */
import { PlaywrightCrawler } from 'crawlee';

import Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { fetchMakesModels, parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { fetchFuelTypes, normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { fetchTransmissionTypes, normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';
import { getBodyTypeMap, normalizeBodyTypeSync } from '@/lib/mobile-bg/body-types';
import { loadMobileBgMakesMapFromDb } from '@/lib/mobile-bg/reference';
import { loginToCarsBg, prepareCarsBgPage } from '@/lib/cars-bg/auth';
import {
  extractCarsId,
  extractThumbFromListing,
  modelsLookEquivalent,
  normCarsBgBody,
  normCarsBgFuel,
  normCarsBgTrans,
  normalizeCarsBgImages,
  parseCarsBgCreatedDateFromImageUrl,
  parseCarsBgEditedDate,
  parseCarsBgPriceToEur,
  parseSpecsString,
  titleOverlapScore,
} from '@/lib/cars-bg/parse';
import { emit, formatError, parseRunnerArgs, DB_PATH } from '@/scraper/lib/runner';

const { deepCrawl, requestedSlugs } = parseRunnerArgs();
const CARS_BG_MAX_IMAGES = 15;

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  carsUrl: string;
  own: number;
  active: number;
  cars_user: string | null;
  cars_password: string | null;
}

interface CarsBgListingInput {
  url: string;
  title?: string | null;
  fuel?: string | null;
  bodyType?: string | null;
  transmission?: string | null;
  price?: { amount?: number | null; currency?: string | null } | null;
  carsbgCreatedDate?: string | null;
  carsbgEditedDate?: string | null;
  description?: string | null;
  dealer?: string | null;
  thumb?: string | null;
  images?: string[] | null;
  color?: string | null;
  power?: number | null;
  mileage?: number | null;
  adStatus?: string | null;
  kaparo?: boolean | number | null;
  year?: string | null;
}

interface CarsBgRunStats {
  processed: number;
  insertedUnique: number;
  insertedDuplicate: number;
  refreshedUnique: number;
  refreshedDuplicate: number;
  changed: number;
  syncNeeded: number;
}

interface MobileDuplicateCandidate {
  id: number;
  mobile_id: string | null;
  title: string | null;
  model: string | null;
  reg_year: string | null;
  mileage: number | null;
  fuel: string | null;
  body_type: string | null;
  current_price: number | null;
  cars_total_views?: number | null;
}

interface CarsBgDuplicateProbe {
  title?: string | null;
  year?: string | null;
  mileage?: number | null;
  fuel?: string | null;
  bodyType?: string | null;
}

interface CarsBgOwnerDetails {
  carsTotalViews: number | null;
  carsImages: string[];
  description: string | null;
}

interface ExistingCarsListing {
  id: number;
  url: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  reg_year: string | null;
  mileage: number | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  power: number | null;
  current_price: number | null;
  price_change: number | null;
  ad_status: string | null;
  kaparo: number | null;
  last_edit: string | null;
  carsbg_title: string | null;
  carsbg_created_date: string | null;
  carsbg_edited_date: string | null;
  cars_total_views?: number | null;
  image_count: number | null;
  full_keys: string | null;
}


function findMatchingMobileListing(
  db: Database.Database,
  dealerId: number,
  listing: CarsBgDuplicateProbe,
  make: string | null,
  model: string | null,
) {
  if (!make || !model) return null;
  const candidates = db.prepare(`
    SELECT id, mobile_id, title, model, reg_year, mileage, fuel, body_type, current_price
    FROM listings
    WHERE source = 'm' AND dealer_id = ? AND make = ? AND is_active = 1
  `).all(dealerId, make) as MobileDuplicateCandidate[];

  let best: { row: MobileDuplicateCandidate; score: number } | null = null;

  for (const row of candidates) {
    let score = 0;
    if (!modelsLookEquivalent(model, row.model)) continue;
    score += 3;

    if (listing.year && row.reg_year) {
      if (String(listing.year) !== String(row.reg_year)) continue;
      score += 4;
    }

    if (listing.mileage != null && row.mileage != null) {
      const diff = Math.abs(Number(listing.mileage) - Number(row.mileage));
      if (diff === 0) {
        score += 5;
      } else if (diff <= 1000) {
        score += 4;
      } else if (diff <= 5000) score += 2;
      else continue;
    }

    if (listing.fuel && row.fuel) {
      if (String(listing.fuel) === String(row.fuel)) score += 2;
    }

    if (listing.bodyType && row.body_type) {
      if (String(listing.bodyType) === String(row.body_type)) score += 1;
    }

    if (listing.title && row.title) {
      score += Math.min(2, titleOverlapScore(listing.title, row.title));
    }

    if (best == null || score > best.score) {
      best = { row, score };
    }
  }

  if (!best) return null;
  return best.score >= 5 ? best.row : null;
}

function applyCarsBgOwnerDetails(
  db: Database.Database,
  dealerId: number,
  carsId: string,
  details: CarsBgOwnerDetails,
): {
  viewsChanged: boolean;
  oldViews: number | null;
  newViews: number | null;
  title: string | null;
  make: string | null;
  model: string | null;
  url: string | null;
  thumb: string | null;
  price: number | null;
  mobilePrice: number | null;
} {
  const existingCars = db.prepare(`
    SELECT *
    FROM listings
    WHERE cars_id = ? AND source = 'c'
  `).get(carsId) as ExistingCarsListing | undefined;

  if (!existingCars) {
    return {
      viewsChanged: false,
      oldViews: null,
      newViews: details.carsTotalViews ?? null,
      title: null,
      make: null,
      model: null,
      url: null,
      thumb: null,
      price: null,
      mobilePrice: null,
    };
  }

  const now = new Date().toISOString();
  const oldViews = existingCars.cars_total_views ?? null;
  const newViews = details.carsTotalViews ?? null;
  const viewsChanged = oldViews != null && newViews != null && oldViews !== newViews;
  const imageCount = details.carsImages.length > 0 ? details.carsImages.length : (existingCars.image_count ?? 0);
  const fullKeys = details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : existingCars.full_keys ?? null;

  if (viewsChanged) {
    db.prepare(`
      INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      existingCars.id,
      null,
      null,
      null,
      oldViews,
      null,
      null,
      null,
      null,
      now,
    );
  }

  const descriptionProvided = typeof details.description === 'string';
  const descriptionField = descriptionProvided ? 'description = ?,' : '';
  const descriptionValues: unknown[] = descriptionProvided ? [details.description!.trim() || null] : [];

  db.prepare(`
    UPDATE listings
    SET
      cars_total_views = ?,
      cars_images = ?,
      image_count = ?,
      full_keys = ?,
      ${descriptionField}
      last_seen_at = ?,
      is_active = 1
    WHERE id = ?
  `).run(
    details.carsTotalViews,
    details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : null,
    imageCount,
    fullKeys,
    ...descriptionValues,
    now,
    existingCars.id,
  );

  const matchingMobile = findMatchingMobileListing(
    db,
    dealerId,
    {
      title: existingCars.title,
      year: existingCars.reg_year,
      mileage: existingCars.mileage,
      fuel: existingCars.fuel,
      bodyType: existingCars.body_type,
    },
    existingCars.make,
    existingCars.model,
  );

  if (!matchingMobile) {
    return {
      viewsChanged,
      oldViews,
      newViews,
      title: existingCars.title ?? null,
      make: existingCars.make ?? null,
      model: existingCars.model ?? null,
      url: existingCars.url ?? null,
      thumb: extractThumbFromListing(existingCars),
      price: existingCars.current_price ?? null,
      mobilePrice: null,
    };
  }

  const oldMobileViews = matchingMobile.cars_total_views ?? null;
  const mobileViewsChanged = oldMobileViews != null && newViews != null && oldMobileViews !== newViews;

  if (mobileViewsChanged) {
    db.prepare(`
      INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      matchingMobile.id,
      null,
      null,
      null,
      oldMobileViews,
      null,
      null,
      null,
      null,
      now,
    );
  }

  db.prepare(`
    UPDATE listings
    SET
      cars_total_views = ?,
      cars_images = ?
    WHERE id = ?
  `).run(
    details.carsTotalViews,
    details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : null,
    matchingMobile.id,
  );

  return {
    viewsChanged,
    oldViews,
    newViews,
    title: existingCars.title ?? null,
    make: existingCars.make ?? null,
    model: existingCars.model ?? null,
    url: existingCars.url ?? null,
    thumb: extractThumbFromListing(existingCars),
    price: existingCars.current_price ?? null,
    mobilePrice: matchingMobile.current_price ?? null,
  };
}

function upsertCarsBgListing(db: Database.Database, dealerId: number, listing: CarsBgListingInput, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
  const now = new Date().toISOString();
  const carsId = extractCarsId(listing.url);
  if (!carsId) return { action: 'skip' as const, title: listing.title || '', make: '', model: '', duplicate: false, trackedChange: false, syncNeeded: false };

  const rawTitle = listing.title || '';
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } = parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || '').trim();

  // Normalize fuel/body/transmission through our mappings
  const fuelRaw = normCarsBgFuel(listing.fuel ?? null);
  const fuel = normalizeFuelSync(fuelRaw, fuelMap);
  const bodyRaw = normCarsBgBody(listing.bodyType ?? null);
  const bodyType = normalizeBodyTypeSync(bodyRaw, getBodyTypeMap());
  const transRaw = normCarsBgTrans(listing.transmission ?? null);
  const transmission = normalizeTransmissionSync(transRaw, transmissionMap);

  const price: number | null = listing.price?.amount ?? null;
  const carsbgTitle: string | null = normalizedTitle || null;
  const carsbgCreatedDate: string | null = listing.carsbgCreatedDate ?? null;
  const carsbgEditedDate: string | null = listing.carsbgEditedDate ?? null;
  // Only deep-crawl scrapes pass a description. Shallow-card scrapes leave it
  // undefined so we preserve whatever we already stored instead of wiping it.
  const rawDescription: string | null | undefined = listing.description;
  const descriptionProvided = typeof rawDescription === 'string';
  const descriptionValue: string | null = descriptionProvided
    ? (rawDescription!.trim() || null)
    : null;
  const matchingMobile = findMatchingMobileListing(db, dealerId, listing, make, model);
  const isDuplicate = matchingMobile ? 1 : 0;
  const mobileCarsPrice = matchingMobile
    && price != null
    && matchingMobile.current_price != null
    && Number(price) === Number(matchingMobile.current_price)
    ? null
    : price;
  const syncNeeded = Boolean(
    matchingMobile &&
    price != null &&
    matchingMobile.current_price != null &&
    Number(price) !== Number(matchingMobile.current_price),
  );

  if (matchingMobile && (carsbgTitle || carsbgCreatedDate || carsbgEditedDate || price != null)) {
    db.prepare(`
      UPDATE listings
      SET
        carsbg_title = ?,
        carsbg_created_date = ?,
        carsbg_edited_date = ?,
        cars_price = ?
      WHERE id = ?
    `).run(
      carsbgTitle,
      carsbgCreatedDate,
      carsbgEditedDate,
      mobileCarsPrice,
      matchingMobile.id,
    );
  }

  const existing = db.prepare('SELECT * FROM listings WHERE cars_id = ? AND source = ?').get(carsId, 'c') as ExistingCarsListing | undefined;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const titleChanged = normalizedTitle !== (existing.title || '');
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const trackedChange = priceChanged || titleChanged || adStatusChanged || kaparoChanged;

    const snapshotPrice = priceChanged ? existing.current_price : null;
    const snapshotAdStatus = adStatusChanged ? (existing.ad_status || 'none') : null;
    const snapshotKaparo = kaparoChanged ? (existing.kaparo ? 1 : 0) : null;
    const snapshotTitle = titleChanged ? (existing.title || null) : null;
    const hasSnapshotPayload =
      snapshotPrice != null ||
      snapshotAdStatus != null ||
      snapshotKaparo != null ||
      (snapshotTitle != null && snapshotTitle.trim() !== '');

    if (trackedChange && hasSnapshotPayload) {
      db.prepare(`
        INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, ad_status, kaparo, title, description, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        snapshotPrice,
        null, null,
        snapshotAdStatus,
        snapshotKaparo,
        snapshotTitle,
        null, now,
      );
      emit({
        type: 'change', carsId, make, model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null, thumb: listing.thumb || null, price,
        mobilePrice: matchingMobile?.current_price ?? null,
        priceChanged, oldPrice: priceChanged ? existing.current_price : null, newPrice: priceChanged ? price : null,
        adStatusChanged, oldStatus: adStatusChanged ? existing.ad_status : null, newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged, titleChanged,
      });
    }

    const priceChangeDelta = priceChanged ? price! - existing.current_price! : existing.price_change ?? null;

    // For deep crawl, update images too
    const hasImages = listing.images && listing.images.length > 0;
    const imageFields = hasImages ? 'image_count = ?, full_keys = ?,' : '';
    const imageValues = hasImages
      ? [listing.images!.length, JSON.stringify(listing.images)]
      : [];

    const descriptionField = descriptionProvided ? 'description = ?,' : '';
    const descriptionValues: unknown[] = descriptionProvided ? [descriptionValue] : [];

    db.prepare(`
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ?,
        fuel = ?, body_type = ?, transmission = ?, color = ?, power = ?, mileage = ?,
        ad_status = ?, kaparo = ?, current_price = ?, price_change = ?,
        reg_year = ?, last_edit = ?, carsbg_title = ?, carsbg_created_date = ?, carsbg_edited_date = ?, cars_price = ?, ${descriptionField} ${imageFields}
        last_seen_at = ?, is_active = 1, duplicate = ?
      WHERE id = ?
    `).run(
      dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId,
      fuel || existing.fuel, bodyType || existing.body_type, transmission || existing.transmission,
      listing.color || existing.color, listing.power || existing.power, listing.mileage || existing.mileage,
      listing.adStatus || existing.ad_status || 'none', listing.kaparo ? 1 : 0,
      price, priceChangeDelta,
      listing.year || existing.reg_year,
      carsbgEditedDate || existing.last_edit || existing.carsbg_edited_date || null,
      carsbgTitle || existing.carsbg_title || null,
      carsbgCreatedDate || existing.carsbg_created_date || null,
      carsbgEditedDate || existing.carsbg_edited_date || null,
      null,
      ...descriptionValues,
      ...imageValues,
      now, isDuplicate, existing.id
    );
    return { action: 'updated' as const, snapshot: priceChanged, title: normalizedTitle, make, model, duplicate: isDuplicate === 1, trackedChange, syncNeeded, mobilePrice: matchingMobile?.current_price ?? null };
  }

  // Insert new
  db.prepare(`
    INSERT INTO listings (
      cars_id, dealer_id, url, title, make, model, mobile_make_id, mobile_model_id,
      fuel, body_type, transmission, color, power, mileage,
      ad_status, kaparo, current_price, reg_year, last_edit, carsbg_title, carsbg_created_date, carsbg_edited_date, cars_price,
      description,
      image_count, full_keys,
      first_seen_at, last_seen_at, is_active, source, duplicate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'c', ?)
  `).run(
    carsId, dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId,
    fuel || null, bodyType || null, transmission || null, listing.color || null, listing.power || null, listing.mileage || null,
    listing.adStatus || 'none', listing.kaparo ? 1 : 0,
    price, listing.year || null, carsbgEditedDate, carsbgTitle, carsbgCreatedDate, carsbgEditedDate, null,
    descriptionValue,
    listing.images?.length || 0,
    listing.images ? JSON.stringify(listing.images) : null,
    now, now, isDuplicate
  );
  return { action: 'inserted' as const, snapshot: false, title: normalizedTitle, make, model, duplicate: isDuplicate === 1, trackedChange: false, syncNeeded, mobilePrice: matchingMobile?.current_price ?? null };
}

async function deepCrawlCarsBgOwnListings(dealer: DealerRow, db: Database.Database) {
  if (!dealer.own || !dealer.cars_user || !dealer.cars_password) {
    emit({ type: 'log', message: `Skipping cars.bg own deep crawl for ${dealer.slug}: missing own-dealer credentials` });
    return 0;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const loggedIn = await loginToCarsBg(page, String(dealer.cars_user), String(dealer.cars_password));
    if (!loggedIn) {
      emit({ type: 'log', level: 'stderr', message: `Cars.bg own deep crawl login failed for ${dealer.slug}` });
      return 0;
    }

    await page.goto('https://www.cars.bg/my_carlist.php?status_typeId=2', { waitUntil: 'domcontentloaded' });
    await prepareCarsBgPage(page);
    await page.waitForTimeout(1500);

    const offerIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-reference]'))
        .map(el => (el.getAttribute('data-reference') || '').trim())
        .filter(Boolean)
    );

    emit({ type: 'log', message: `Cars.bg own deep crawl for ${dealer.slug}: found ${offerIds.length} own offers` });

    let updated = 0;
    for (const carsId of offerIds) {
      const ownerUrl = `https://www.cars.bg/offer/${carsId}?myoffer=1`;
      await page.goto(ownerUrl, { waitUntil: 'domcontentloaded' });
      await prepareCarsBgPage(page);
      await page.waitForTimeout(800);

      const details = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const viewsMatch = bodyText.match(/Общо разглеждания:\s*([\d\s]+)/i);
        const carsTotalViews = viewsMatch
          ? Number.parseInt((viewsMatch[1] || '').replace(/[^\d]/g, ''), 10) || null
          : null;

        const imageUrls = Array.from(document.querySelectorAll('img'))
          .map(img => (img.getAttribute('src') || '').trim())
          .filter(Boolean);

        let description: string | null = null;
        const notesNode = document.querySelector('div.offer-notes');
        if (notesNode) {
          const clone = notesNode.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
          description = (clone.textContent || '')
            .replace(/\r/g, '')
            .replace(/Възможност за бартер/g, '')
            .replace(/Възможност за лизинг/g, '')
            .replace(/Възможност за данъчен кредит/g, '')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim() || null;
        }

        return {
          carsTotalViews,
          carsImages: imageUrls,
          description,
        };
      });

      const normalized: CarsBgOwnerDetails = {
        carsTotalViews: details.carsTotalViews,
        carsImages: normalizeCarsBgImages(details.carsImages),
        description: details.description,
      };

      const ownerUpdate = applyCarsBgOwnerDetails(db, Number(dealer.id), carsId, normalized);
      updated++;

      if (ownerUpdate.viewsChanged) {
        emit({
          type: 'change',
          carsId,
          dealer: dealer.slug,
          make: ownerUpdate.make,
          model: ownerUpdate.model,
          title: ownerUpdate.title,
          url: ownerUpdate.url,
          thumb: ownerUpdate.thumb,
          price: ownerUpdate.price,
          mobilePrice: ownerUpdate.mobilePrice,
          viewsChanged: true,
          oldViews: ownerUpdate.oldViews,
          newViews: ownerUpdate.newViews,
        });
      }

      emit({
        type: 'log',
        message: `Cars.bg own detail ${dealer.slug}/${carsId}: views ${normalized.carsTotalViews ?? '—'}, images ${normalized.carsImages.length}`,
      });
    }

    return updated;
  } finally {
    await browser.close();
  }
}

async function scrapeCarsBgForUI(dealer: DealerRow, db: Database.Database, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
  let count = 0;
  const maxPages = 20;
  const stats: CarsBgRunStats = {
    processed: 0,
    insertedUnique: 0,
    insertedDuplicate: 0,
    refreshedUnique: 0,
    refreshedDuplicate: 0,
    changed: 0,
    syncNeeded: 0,
  };

  const failedUrls: string[] = [];

  const crawler = new PlaywrightCrawler({
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 120,
    headless: true,
    maxConcurrency: 2,
    navigationTimeoutSecs: 60,

    preNavigationHooks: [
      async ({ request }) => {
        if (request.retryCount > 0) {
          const delaySec = request.retryCount * 5;
          emit({ type: 'log', message: `Retry #${request.retryCount} for ${request.url} — waiting ${delaySec}s` });
          await new Promise(r => setTimeout(r, delaySec * 1000));
        }
      },
    ],

    async requestHandler({ page, request }) {
      await prepareCarsBgPage(page);
      const url = request.url;

      if (request.label === 'LIST' || !request.label) {
        // Cars.bg loads listings dynamically via Scrollable into #listContainer.
        // Wait for the container to have offer links.
        await page.waitForSelector('#listContainer a[href*="/offer/"]', { timeout: 15000 }).catch(() => {});
        // Small extra wait for all cards to render
        await page.waitForTimeout(1000);

        if (deepCrawl) {
          // Collect links and queue them for detail scraping
          const links = await page.$$eval('#listContainer a[href*="/offer/"]', els =>
            [...new Set(els.map(a => (a as HTMLAnchorElement).href))].filter(h => h.includes('/offer/'))
          );
          emit({ type: 'log', message: `Found ${links.length} offer links on ${url}` });
          for (const link of links) {
            await crawler.addRequests([{ url: link, label: 'DETAIL' }]);
          }
        } else {
          // Shallow mode: extract from the card structure
          // Each card is an outer .offer cell with:
          // - overline date line above the link
          // - <a href="/offer/..."> containing media + price + make/model + specs/description divs
          const cards = await page.evaluate(() => {
            const results: {
              url: string; title: string; dateText: string; priceText: string; specsText: string; thumb: string;
            }[] = [];

            const offerCards = document.querySelectorAll('#listContainer .offer');
            const seen = new Set<string>();

            for (const card of offerCards) {
              const a = card.querySelector('a[href*="/offer/"]');
              if (!a) continue;
              const href = (a as HTMLAnchorElement).href;
              if (seen.has(href) || !href.includes('/offer/')) continue;
              seen.add(href);

              // Title from <h5> inside the link
              const h5 = a.querySelector('h5');
              const title = h5?.textContent?.trim() || '';
              if (!title) continue;

              const dateNode = card.querySelector('.card__subtitle');
              const dateText = dateNode?.textContent?.replace(/\s+/g, ' ').trim() || '';

              // Price block contains both EUR and BGN; take the whole text and parse EUR later.
              const priceNode = a.querySelector('.price');
              const priceText = priceNode?.textContent?.trim() || '';

              // Specs are in the first body1 secondary block; body2 is the description snippet.
              const specsNode = a.querySelector('.card__secondary.mdc-typography--body1');
              const specsText = specsNode?.textContent?.replace(/\s+/g, ' ').trim() || '';

              let thumb = '';
              const img = a.querySelector('img') as HTMLImageElement | null;
              const imgCandidates = [
                img?.currentSrc,
                img?.src,
                img?.getAttribute('src'),
                img?.getAttribute('data-src'),
                img?.getAttribute('data-lazy'),
                img?.getAttribute('data-original'),
              ];
              for (const candidate of imgCandidates) {
                if (!candidate) continue;
                try {
                  thumb = new URL(candidate, location.href).href;
                } catch {
                  thumb = candidate;
                }
                if (thumb) break;
              }

              if (!thumb) {
                const bgElements = [
                  a.querySelector('.mdc-card__media') as HTMLElement | null,
                  a.querySelector('[style*="background-image"]') as HTMLElement | null,
                  a as HTMLElement,
                ].filter(Boolean) as HTMLElement[];

                for (const element of bgElements) {
                  const bgCandidates = [
                    element.style.backgroundImage,
                    element.getAttribute('style') || '',
                    getComputedStyle(element).backgroundImage,
                  ];
                  for (const candidate of bgCandidates) {
                    const match = candidate.match(/url\(["']?(.*?)["']?\)/i);
                    const raw = match?.[1];
                    if (!raw) continue;
                    try {
                      thumb = new URL(raw, location.href).href;
                    } catch {
                      thumb = raw;
                    }
                    if (thumb) break;
                  }
                  if (thumb) break;
                }
              }

              results.push({ url: href, title, dateText, priceText, specsText, thumb });
            }

            return results;
          });

          emit({ type: 'log', message: `Found ${cards.length} listing cards on ${url}` });

          for (const card of cards) {
            const priceEur = parseCarsBgPriceToEur(card.priceText);

            // Parse specs string
            const specs = parseSpecsString(card.specsText);

            const listing = {
              url: card.url, title: card.title,
              adStatus: 'none', kaparo: false,
              thumb: card.thumb,
              carsbgEditedDate: parseCarsBgEditedDate(card.dateText),
              carsbgCreatedDate: parseCarsBgCreatedDateFromImageUrl(card.thumb),
              price: { amount: priceEur, currency: 'EUR' },
              year: specs.year, mileage: specs.mileage, power: specs.power,
              fuel: specs.fuel, transmission: specs.transmission, bodyType: specs.bodyType,
              color: specs.color, images: card.thumb ? [card.thumb] : null,
              dealer: dealer.slug,
            };
            const result = upsertCarsBgListing(db, dealer.id, listing, makesMap, fuelMap, transmissionMap);
            count++;
            stats.processed++;
            if (result.action === 'inserted') {
              if (result.duplicate) stats.insertedDuplicate++;
              else stats.insertedUnique++;
            } else if (result.action === 'updated') {
              if (result.duplicate) stats.refreshedDuplicate++;
              else stats.refreshedUnique++;
              if (result.trackedChange) stats.changed++;
            }
            if (result.syncNeeded) stats.syncNeeded++;
            emit({
              type: 'listing', dealer: dealer.slug,
              make: result.make, model: result.model, title: result.title,
              price: priceEur, url: card.url, thumb: card.thumb,
              mobilePrice: result.mobilePrice ?? null,
              newListing: result.action === 'inserted' && !result.duplicate, uniqueMatch: !result.duplicate, syncNeeded: result.syncNeeded, imageCount: 0,
            });
          }
        }

        // Pagination: check for next page link
        const currentPage = parseInt(new URL(url).searchParams.get('page') || '1', 10);
        if (currentPage < maxPages) {
          const hasNext = await page.evaluate((cp: number) =>
            Array.from(document.querySelectorAll('a')).some(a =>
              a.href.includes(`page=${cp + 1}`) || a.textContent?.trim() === String(cp + 1)
            ), currentPage
          );
          if (hasNext) {
            const nextUrl = new URL(dealer.carsUrl as string);
            nextUrl.searchParams.set('page', String(currentPage + 1));
            await crawler.addRequests([{ url: nextUrl.toString(), label: 'LIST' }]);
          }
        }
      }

      if (request.label === 'DETAIL') {
        // Deep scrape: detail page
        // Title: <h2>, Price: "XX,XXX\nYY,YYY.YY\nEUR\nBGN" block
        // Specs: comma-separated string like "Януари 2019, Седан, ..., Дизел, 219 000км, ..."
        // Images: <img src="https://g1-bg.cars.bg/...">

        const data = await page.evaluate(() => {
          // Title
          const h2 = document.querySelector('h2');
          const title = h2 ? h2.textContent?.trim() || '' : '';

          // Price: find text containing EUR and BGN amounts
          // The price block renders as "38,500\n75,299.46\nEUR\nBGN" in innerText
          const body = document.body.innerText;
          const priceNode = document.querySelector('.offer-price');
          const priceText = priceNode?.textContent?.trim() || '';

          // Specs: comma-separated line with year, fuel, mileage etc.
          // Look for the line that starts with a Bulgarian month or a 4-digit year and contains "км"
          const specsMatch = body.match(/((?:Януари|Февруари|Март|Април|Май|Юни|Юли|Август|Септември|Октомври|Ноември|Декември)?\s*\d{4},.+?км\.?.*?)(?:\n|$)/);
          const specsLine = specsMatch ? specsMatch[1].trim() : '';

          // Description: dealer free-text lives in `div.offer-notes`. Convert <br> to
          // newlines before reading textContent so the stored copy matches what the
          // mobile.bg draft would render.
          let description: string | null = null;
          const notesNode = document.querySelector('div.offer-notes');
          if (notesNode) {
            const clone = notesNode.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
            description = (clone.textContent || '')
              .replace(/\r/g, '')
              .replace(/[ \t]+\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim() || null;
          }

          // Images: on g1-bg.cars.bg CDN
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
          const images = [...document.querySelectorAll('img')]
            .map(img => img.src)
            .filter(s => s && s.includes('g1-bg.cars.bg') && s.match(/\/20\d{2}/));

          return { title, priceText, specsLine, description, ogImage, images };
        });

        const priceEur = parseCarsBgPriceToEur(data.priceText);
        const images = [...new Set([data.ogImage, ...data.images].filter(Boolean))];
        const specs = parseSpecsString(data.specsLine);

        const listing = {
          url, title: data.title,
          adStatus: 'none', kaparo: false, thumb: images[0] || '',
          carsbgEditedDate: null,
          carsbgCreatedDate: parseCarsBgCreatedDateFromImageUrl(images[0] || ''),
          price: { amount: priceEur, currency: 'EUR' },
          year: specs.year, mileage: specs.mileage, power: specs.power,
          fuel: specs.fuel, transmission: specs.transmission, bodyType: specs.bodyType,
          color: specs.color,
          description: data.description,
          images: images.slice(0, CARS_BG_MAX_IMAGES),
          dealer: dealer.slug,
        };
        const result = upsertCarsBgListing(db, dealer.id, listing, makesMap, fuelMap, transmissionMap);
        count++;
        stats.processed++;
        if (result.action === 'inserted') {
          if (result.duplicate) stats.insertedDuplicate++;
          else stats.insertedUnique++;
        } else if (result.action === 'updated') {
          if (result.duplicate) stats.refreshedDuplicate++;
          else stats.refreshedUnique++;
          if (result.trackedChange) stats.changed++;
        }
        if (result.syncNeeded) stats.syncNeeded++;
        emit({
          type: 'listing', dealer: dealer.slug,
          make: result.make, model: result.model, title: result.title,
          price: priceEur, url, thumb: images[0] || '',
          mobilePrice: result.mobilePrice ?? null,
          newListing: result.action === 'inserted' && !result.duplicate, uniqueMatch: !result.duplicate, syncNeeded: result.syncNeeded, imageCount: images.length,
        });
      }
    },

    failedRequestHandler({ request }, error) {
      const url = request.url;
      failedUrls.push(url);
      const errorMsg = formatError(error);
      emit({ type: 'warn', message: `Permanently failed after ${request.retryCount} retries: ${url}` });
      db.prepare(`
        INSERT INTO scrape_failures (dealer_id, dealer_slug, url, source, retry_count, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        dealer.id,
        dealer.slug,
        url,
        'cars.bg',
        request.retryCount,
        errorMsg,
        new Date().toISOString(),
      );
    },
  });

  await crawler.run([{ url: dealer.carsUrl as string, label: 'LIST' }]);
  if (failedUrls.length > 0) {
    emit({
      type: 'warn',
      message: `${failedUrls.length} request(s) failed permanently for ${dealer.slug} (cars.bg)`,
      failedUrls,
    });
  }
  if (deepCrawl && dealer.own) {
    const ownUpdated = await deepCrawlCarsBgOwnListings(dealer, db);
    emit({ type: 'log', message: `Cars.bg own deep crawl for ${dealer.slug}: updated ${ownUpdated} listings` });
  }
  emit({
    type: 'log',
    message: `Cars.bg summary for ${dealer.slug}: ${stats.insertedUnique} unique inserted, ${stats.insertedDuplicate} duplicate inserted, ${stats.refreshedUnique} unique refreshed, ${stats.refreshedDuplicate} duplicate refreshed, ${stats.changed} changed, ${stats.syncNeeded} need mobile sync`,
  });
  return { count, stats };
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const makesMap = loadMobileBgMakesMapFromDb(db) ?? await fetchMakesModels().catch(() => null);
  const fuelMap = await fetchFuelTypes().catch(() => null);
  const transmissionMap = await fetchTransmissionTypes().catch(() => null);

  const dealers = db.prepare(`
    SELECT id, slug, name, cars_url as carsUrl, own, active,
           cars_user, cars_password
    FROM dealers WHERE active = 1 AND cars_url IS NOT NULL ORDER BY name
  `).all() as DealerRow[];

  const selected = requestedSlugs.length > 0 ? dealers.filter(d => requestedSlugs.includes(d.slug)) : dealers;

  if (selected.length === 0) {
    emit({ type: 'error', message: 'No matching dealers with cars.bg URL found' });
    process.exit(1);
  }

  let hadErrors = false;
  const totals: CarsBgRunStats = {
    processed: 0,
    insertedUnique: 0,
    insertedDuplicate: 0,
    refreshedUnique: 0,
    refreshedDuplicate: 0,
    changed: 0,
    syncNeeded: 0,
  };
  for (const dealer of selected) {
    emit({ type: 'log', message: `Starting cars.bg scrape: ${dealer.name}` });
    try {
      const { count, stats } = await scrapeCarsBgForUI(dealer, db, makesMap, fuelMap, transmissionMap);
      totals.processed += stats.processed;
      totals.insertedUnique += stats.insertedUnique;
      totals.insertedDuplicate += stats.insertedDuplicate;
      totals.refreshedUnique += stats.refreshedUnique;
      totals.refreshedDuplicate += stats.refreshedDuplicate;
      totals.changed += stats.changed;
      totals.syncNeeded += stats.syncNeeded;
      emit({ type: 'done', dealer: dealer.slug, count });
    } catch (err) {
      hadErrors = true;
      emit({ type: 'error', message: `Error scraping ${dealer.name}: ${formatError(err)}` });
    }
  }

  if (!hadErrors) {
    emit({
      type: 'seeded',
      message: `Cars.bg saved: ${totals.insertedUnique} unique inserted, ${totals.insertedDuplicate} duplicates inserted, ${totals.refreshedUnique} unique refreshed, ${totals.refreshedDuplicate} duplicates refreshed, ${totals.changed} changed, ${totals.syncNeeded} need mobile sync`,
    });
  }
  db.close();
}

main().catch(err => {
  emit({ type: 'error', message: formatError(err) });
  process.exit(1);
});
