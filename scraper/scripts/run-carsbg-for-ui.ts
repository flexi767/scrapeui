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

import { chromium } from 'playwright';
import type Database from 'better-sqlite3';
import type { MakesMap } from '@/lib/mobile-bg/makes-models';
import { loadMobileBgMakesMapFromDb } from '@/lib/mobile-bg/reference';
import { currentIsoTimestamp } from '@/lib/date-format';
import { loginToCarsBg, prepareCarsBgPage } from '@/lib/cars-bg/auth';
import {
  extractCarsBgDetailFromDocument,
  extractCarsBgListCardsFromDocument,
  extractCarsBgOwnOfferIdsFromDocument,
  extractCarsBgOwnerDetailFromDocument,
} from '@/lib/cars-bg/dom-extractors';
import {
  applyCarsBgOwnerDetails,
  upsertCarsBgListing,
  type CarsBgScrapedListing,
  type CarsBgOwnerDetails,
} from '@/lib/cars-bg/listing-persistence';
import {
  normalizeCarsBgImages,
  parseCarsBgCreatedDateFromImageUrl,
  parseCarsBgEditedDate,
  parseCarsBgPriceToEur,
  parseSpecsString,
} from '@/lib/cars-bg/parse';
import { emit, formatError, parseRunnerArgs, openDb, fetchRunnerRefData } from '@/scraper/lib/runner';

const { deepCrawl, requestedSlugs } = parseRunnerArgs();
const CARS_BG_MAX_IMAGES = 15;

interface CarsBgRunStats {
  processed: number;
  insertedUnique: number;
  insertedDuplicate: number;
  refreshedUnique: number;
  refreshedDuplicate: number;
  changed: number;
  syncNeeded: number;
}

interface CarsBgDealerRow {
  id: number;
  slug: string;
  name: string;
  carsUrl: string;
  own: number | null;
  active: number | null;
  cars_user: string | null;
  cars_password: string | null;
}

interface CarsBgListingEmitData {
  price: number | null;
  url: string;
  thumb: string;
  imageCount: number;
}

function processCarsBgListing(
  db: Database.Database,
  dealer: CarsBgDealerRow,
  stats: CarsBgRunStats,
  listing: CarsBgScrapedListing,
  emitData: CarsBgListingEmitData,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
) {
  const result = upsertCarsBgListing(db, dealer.id, listing, makesMap, fuelMap, transmissionMap);
  if (result.changeEvent) emit(result.changeEvent);

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
    type: 'listing',
    dealer: dealer.slug,
    make: result.make,
    model: result.model,
    title: result.title,
    price: emitData.price,
    url: emitData.url,
    thumb: emitData.thumb,
    mobilePrice: result.mobilePrice ?? null,
    newListing: result.action === 'inserted' && !result.duplicate,
    uniqueMatch: !result.duplicate,
    syncNeeded: result.syncNeeded,
    imageCount: emitData.imageCount,
  });
}

async function deepCrawlCarsBgOwnListings(dealer: CarsBgDealerRow, db: Database.Database) {
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

    const offerIds = await page.evaluate(extractCarsBgOwnOfferIdsFromDocument);

    emit({ type: 'log', message: `Cars.bg own deep crawl for ${dealer.slug}: found ${offerIds.length} own offers` });

    let updated = 0;
    for (const carsId of offerIds) {
      const ownerUrl = `https://www.cars.bg/offer/${carsId}?myoffer=1`;
      await page.goto(ownerUrl, { waitUntil: 'domcontentloaded' });
      await prepareCarsBgPage(page);
      await page.waitForTimeout(800);

      const details = await page.evaluate(extractCarsBgOwnerDetailFromDocument);

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

async function scrapeCarsBgForUI(dealer: CarsBgDealerRow, db: Database.Database, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
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
          const cards = await page.evaluate(extractCarsBgListCardsFromDocument);

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
            processCarsBgListing(
              db,
              dealer,
              stats,
              listing,
              { price: priceEur, url: card.url, thumb: card.thumb, imageCount: 0 },
              makesMap,
              fuelMap,
              transmissionMap,
            );
            count++;
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

        const data = await page.evaluate(extractCarsBgDetailFromDocument);

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
        processCarsBgListing(
          db,
          dealer,
          stats,
          listing,
          { price: priceEur, url, thumb: images[0] || '', imageCount: images.length },
          makesMap,
          fuelMap,
          transmissionMap,
        );
        count++;
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
        currentIsoTimestamp(),
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
  const db = openDb();
  const dbMakesMap = loadMobileBgMakesMapFromDb(db);
  const { makesMap, fuelMap, transmissionMap } = await fetchRunnerRefData(
    dbMakesMap ? { makesMap: dbMakesMap } : {}
  );

  const dealers = db.prepare(`
    SELECT id, slug, name, cars_url as carsUrl, own, active,
           cars_user, cars_password
    FROM dealers WHERE active = 1 AND cars_url IS NOT NULL ORDER BY name
  `).all() as CarsBgDealerRow[];

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
