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
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import Database from 'better-sqlite3';
import { fetchMakesModels, parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { fetchFuelTypes, normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { fetchTransmissionTypes, normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';
import { getBodyTypeMap, normalizeBodyTypeSync } from '@/lib/mobile-bg/body-types';
import { loadMobileBgMakesMapFromDb } from '@/lib/mobile-bg/reference';
import { prepareCarsBgPage } from '@/lib/cars-bg/auth';

// Parse args
const args = process.argv.slice(2);
const dealersIdx = args.indexOf('--dealers');
const dealerArg = dealersIdx !== -1 && args[dealersIdx + 1] ? args[dealersIdx + 1] : '';
const deepCrawl = args.includes('--deep');
const requestedSlugs = dealerArg ? dealerArg.split(',').map(s => s.trim()) : [];

function emit(obj: object) {
  process.stdout.write(JSON.stringify(obj) + '\n');
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
  reg_year: string | null;
  mileage: number | null;
  fuel: string | null;
  body_type: string | null;
  current_price: number | null;
}

interface CarsBgDuplicateProbe {
  title?: string | null;
  year?: string | null;
  mileage?: number | null;
  fuel?: string | null;
  bodyType?: string | null;
}

function formatError(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const e = err as Record<string, unknown>;
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev) return (e.message as string) || 'Scrape failed';
  if (Array.isArray(e.errors) && e.errors.length > 0) return e.errors.map(formatError).filter(Boolean).join(' | ');
  if (e.cause) {
    const cause = formatError(e.cause);
    if (cause && cause !== e.message) return `${e.message}: ${cause}`;
  }
  if (e.message) return e.message as string;
  return util.inspect(err, { depth: 4, breakLength: 120 });
}

/** Extract cars.bg offer hex ID from URL like /offer/68bfd7021598f924570a0a52 */
function extractCarsId(url: string): string | null {
  const m = url?.match(/\/offer\/([a-f0-9]{10,})/i);
  return m ? m[1] : null;
}

/** Map Bulgarian fuel strings from cars.bg to our normalized values */
const CARSBG_FUEL_MAP: Record<string, string> = {
  'бензин': 'Бензин',
  'дизел': 'Дизел',
  'хибрид': 'Хибрид',
  'електрически': 'Електрически',
  'газ/бензин': 'Газ/Бензин',
  'газ': 'Газ/Бензин',
};

/** Map Bulgarian transmission strings from cars.bg */
const CARSBG_TRANS_MAP: Record<string, string> = {
  'автоматични скорости': 'Автоматична',
  'автоматична': 'Автоматична',
  'ръчни скорости': 'Ръчна',
  'ръчна': 'Ръчна',
};

/** Map Bulgarian body types from cars.bg */
const CARSBG_BODY_MAP: Record<string, string> = {
  'седан': 'Седан',
  'хечбек': 'Хечбек',
  'комби': 'Комби',
  'suv': 'Джип/SUV',
  'джип': 'Джип/SUV',
  'купе': 'Купе',
  'кабрио': 'Кабрио',
  'ван': 'Ван',
  'миниван': 'Миниван',
};

function normCarsBgFuel(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_FUEL_MAP[raw.toLowerCase().trim()] ?? raw;
}

function normCarsBgTrans(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_TRANS_MAP[raw.toLowerCase().trim()] ?? raw;
}

function normCarsBgBody(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_BODY_MAP[raw.toLowerCase().trim()] ?? raw;
}

/**
 * Parse the specs string from either the list card <p> or the detail page.
 * Format: "2019, Дизел, 219000 км." or
 *         "Януари 2019, Седан, ..., Дизел, 219 000км, Автоматични скорости, 286к.с., 4/5 врати, Тъмно син металик"
 */
function parseSpecsString(specs: string) {
  // Year: 4-digit number (with optional Bulgarian month before it)
  const yearMatch = specs.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : null;

  // Mileage: digits (possibly with spaces) followed by км
  const mileageMatch = specs.match(/([\d\s]+)\s*км/);
  const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/\s/g, '')) || null : null;

  // Power: digits followed by к.с.
  const powerMatch = specs.match(/(\d+)\s*к\.с\./);
  const power = powerMatch ? parseInt(powerMatch[1]) : null;

  // Fuel
  const fuelMatch = specs.match(/(Бензин|Дизел|Хибрид|Електрически|Газ\/Бензин)/i);
  const fuel = fuelMatch ? fuelMatch[1] : null;

  // Transmission
  const transMatch = specs.match(/(Автоматични скорости|Ръчни скорости)/i);
  const transmission = transMatch ? transMatch[1] : null;

  // Body type: comes right after the year as second comma-separated token
  const bodyMatch = specs.match(/(Седан|Хечбек|Комби|SUV|Джип|Купе|Кабрио|Ван|Миниван)/i);
  const bodyType = bodyMatch ? bodyMatch[1] : null;

  // Color: after "X/Y врати, " pattern
  const colorMatch = specs.match(/\d\/\d\s+врати,\s+(.+?)$/);
  const color = colorMatch ? colorMatch[1].trim() : null;

  return { year, mileage, power, fuel, transmission, bodyType, color };
}

function parseCarsBgPriceToEur(value: string | null | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/\u00a0/g, ' ').trim();
  const firstLineWithDigits = normalized
    .split('\n')
    .map((part) => part.trim())
    .find((part) => /\d/.test(part));
  const raw = firstLineWithDigits?.match(/[\d][\d ,.]*/)?.[0]
    ?? normalized.match(/[\d][\d ,.]*/)?.[0]
    ?? null;

  if (!raw) return null;

  const integerPart = raw.replace(/[^\d]/g, '');

  if (!integerPart) return null;

  const parsed = Number.parseInt(integerPart, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCarsBgCreatedDateFromImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\/(20\d{2}-\d{2}-\d{2})_\d+\//);
  return match ? match[1] : null;
}

function parseCarsBgEditedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\b(\d{2})\.(\d{2})\.(\d{2}|\d{4})\b/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function normalizeCompareText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
  const aTokens = new Set(normalizeCompareText(a).split(' ').filter((token) => token.length > 2));
  const bTokens = new Set(normalizeCompareText(b).split(' ').filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
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
    SELECT id, mobile_id, title, reg_year, mileage, fuel, body_type, current_price
    FROM listings
    WHERE source = 'm' AND dealer_id = ? AND make = ? AND model = ? AND is_active = 1
  `).all(dealerId, make, model) as MobileDuplicateCandidate[];

  let best: { row: MobileDuplicateCandidate; score: number } | null = null;

  for (const row of candidates) {
    let score = 0;

    if (listing.year && row.reg_year) {
      if (String(listing.year) !== String(row.reg_year)) continue;
      score += 4;
    }

    if (listing.mileage != null && row.mileage != null) {
      const diff = Math.abs(Number(listing.mileage) - Number(row.mileage));
      if (diff === 0) score += 5;
      else if (diff <= 1000) score += 4;
      else if (diff <= 5000) score += 2;
      else continue;
    }

    if (listing.fuel && row.fuel) {
      if (String(listing.fuel) === String(row.fuel)) score += 2;
      else continue;
    }

    if (listing.bodyType && row.body_type) {
      if (String(listing.bodyType) === String(row.body_type)) score += 1;
    }

    score += Math.min(3, titleOverlapScore(listing.title, row.title));

    if (best == null || score > best.score) {
      best = { row, score };
    }
  }

  if (!best) return null;
  return best.score >= 6 ? best.row : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function upsertCarsBgListing(db: Database.Database, dealerId: number, listing: Record<string, any>, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
  const now = new Date().toISOString();
  const carsId = extractCarsId(listing.url);
  if (!carsId) return { action: 'skip' as const, title: listing.title || '', make: '', model: '', duplicate: false, trackedChange: false, syncNeeded: false };

  const rawTitle = listing.title || '';
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } = parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || '').trim();

  // Normalize fuel/body/transmission through our mappings
  const fuelRaw = normCarsBgFuel(listing.fuel);
  const fuel = normalizeFuelSync(fuelRaw, fuelMap);
  const bodyRaw = normCarsBgBody(listing.bodyType);
  const bodyType = normalizeBodyTypeSync(bodyRaw, getBodyTypeMap());
  const transRaw = normCarsBgTrans(listing.transmission);
  const transmission = normalizeTransmissionSync(transRaw, transmissionMap);

  const price: number | null = listing.price?.amount ?? null;
  const carsbgTitle: string | null = normalizedTitle || null;
  const carsbgCreatedDate: string | null = listing.carsbgCreatedDate ?? null;
  const carsbgEditedDate: string | null = listing.carsbgEditedDate ?? null;
  const matchingMobile = findMatchingMobileListing(db, dealerId, listing, make, model);
  const isDuplicate = matchingMobile ? 1 : 0;
  const syncNeeded = Boolean(
    matchingMobile &&
    price != null &&
    matchingMobile.current_price != null &&
    Number(price) !== Number(matchingMobile.current_price),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = db.prepare('SELECT * FROM listings WHERE cars_id = ? AND source = ?').get(carsId, 'c') as Record<string, any> | undefined;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const titleChanged = normalizedTitle !== (existing.title || '');
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const trackedChange = priceChanged || titleChanged || adStatusChanged || kaparoChanged;

    if (trackedChange) {
      db.prepare(`
        INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, ad_status, kaparo, title, description, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        priceChanged ? existing.current_price : null,
        null, null,
        adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged ? (listing.kaparo ? 1 : 0) : null,
        titleChanged ? normalizedTitle : null,
        null, now,
      );
      emit({
        type: 'change', carsId, make, model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null, thumb: listing.thumb || null, price,
        priceChanged, oldPrice: priceChanged ? existing.current_price : null, newPrice: priceChanged ? price : null,
        adStatusChanged, oldStatus: adStatusChanged ? existing.ad_status : null, newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged, titleChanged,
      });
    }

    const priceChangeDelta = priceChanged ? price! - existing.current_price : existing.price_change ?? null;

    // For deep crawl, update images too
    const hasImages = listing.images && listing.images.length > 0;
    const imageFields = hasImages ? 'image_count = ?, full_keys = ?,' : '';
    const imageValues = hasImages
      ? [listing.images.length, JSON.stringify(listing.images)]
      : [];

    db.prepare(`
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ?,
        fuel = ?, body_type = ?, transmission = ?, color = ?, power = ?, mileage = ?,
        ad_status = ?, kaparo = ?, current_price = ?, price_change = ?,
        reg_year = ?, carsbg_title = ?, carsbg_created_date = ?, carsbg_edited_date = ?, ${imageFields}
        last_seen_at = ?, is_active = 1, duplicate = ?
      WHERE id = ?
    `).run(
      dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId,
      fuel || existing.fuel, bodyType || existing.body_type, transmission || existing.transmission,
      listing.color || existing.color, listing.power || existing.power, listing.mileage || existing.mileage,
      listing.adStatus || existing.ad_status || 'none', listing.kaparo ? 1 : 0,
      price, priceChangeDelta,
      listing.year || existing.reg_year,
      carsbgTitle || existing.carsbg_title || null,
      carsbgCreatedDate || existing.carsbg_created_date || null,
      carsbgEditedDate || existing.carsbg_edited_date || null,
      ...imageValues,
      now, isDuplicate, existing.id
    );
    return { action: 'updated' as const, snapshot: priceChanged, title: normalizedTitle, make, model, duplicate: isDuplicate === 1, trackedChange, syncNeeded };
  }

  // Insert new
  db.prepare(`
    INSERT INTO listings (
      cars_id, dealer_id, url, title, make, model, mobile_make_id, mobile_model_id,
      fuel, body_type, transmission, color, power, mileage,
      ad_status, kaparo, current_price, reg_year, carsbg_title, carsbg_created_date, carsbg_edited_date,
      image_count, full_keys,
      first_seen_at, last_seen_at, is_active, source, duplicate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'c', ?)
  `).run(
    carsId, dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId,
    fuel || null, bodyType || null, transmission || null, listing.color || null, listing.power || null, listing.mileage || null,
    listing.adStatus || 'none', listing.kaparo ? 1 : 0,
    price, listing.year || null, carsbgTitle, carsbgCreatedDate, carsbgEditedDate,
    listing.images?.length || 0,
    listing.images ? JSON.stringify(listing.images) : null,
    now, now, isDuplicate
  );
  return { action: 'inserted' as const, snapshot: false, title: normalizedTitle, make, model, duplicate: isDuplicate === 1, trackedChange: false, syncNeeded };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scrapeCarsBgForUI(dealer: Record<string, any>, db: Database.Database, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
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

  const crawler = new PlaywrightCrawler({
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 120,
    headless: true,
    maxConcurrency: 2,
    navigationTimeoutSecs: 60,

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
          // Each card: <a href="/offer/HEX"> containing <h5> title, <h6> price, <p> specs
          const cards = await page.evaluate(() => {
            const results: {
              url: string; title: string; dateText: string; priceText: string; specsText: string; thumb: string;
            }[] = [];

            const offerLinks = document.querySelectorAll('#listContainer a[href*="/offer/"]');
            const seen = new Set<string>();

            for (const a of offerLinks) {
              const href = (a as HTMLAnchorElement).href;
              if (seen.has(href) || !href.includes('/offer/')) continue;
              seen.add(href);

              // Title from <h5> inside the link
              const h5 = a.querySelector('h5');
              const title = h5?.textContent?.trim() || '';
              if (!title) continue;

              const h6s = a.querySelectorAll('h6');
              const dateText = h6s[0]?.textContent?.trim() || '';

              // Price block contains both EUR and BGN; take the whole text and parse EUR later.
              const priceNode = a.querySelector('.price');
              const priceText = priceNode?.textContent?.trim() || '';

              // Specs from first <p> (second <p> is description snippet)
              const firstP = a.querySelector('p');
              const specsText = firstP?.textContent?.trim() || '';

              // List cards use a CSS background-image rather than an <img>.
              const media = a.querySelector('.mdc-card__media') as HTMLElement | null;
              const bg = media?.style.backgroundImage || '';
              const thumb = bg.match(/url\(["']?(.*?)["']?\)/)?.[1] || '';

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
              color: specs.color, images: null,
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

          // Images: on g1-bg.cars.bg CDN
          const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
          const images = [...document.querySelectorAll('img')]
            .map(img => img.src)
            .filter(s => s && s.includes('g1-bg.cars.bg') && s.match(/\/20\d{2}/));

          return { title, priceText, specsLine, ogImage, images };
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
          images: images.slice(0, 15),
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
          newListing: result.action === 'inserted' && !result.duplicate, uniqueMatch: !result.duplicate, syncNeeded: result.syncNeeded, imageCount: images.length,
        });
      }
    },

    failedRequestHandler({ request }) {
      emit({ type: 'log', level: 'stderr', message: `Failed after retries: ${request.url}` });
    },
  });

  await crawler.run([{ url: dealer.carsUrl as string, label: 'LIST' }]);
  emit({
    type: 'log',
    message: `Cars.bg summary for ${dealer.slug}: ${stats.insertedUnique} unique inserted, ${stats.insertedDuplicate} duplicate inserted, ${stats.refreshedUnique} unique refreshed, ${stats.refreshedDuplicate} duplicate refreshed, ${stats.changed} changed, ${stats.syncNeeded} need mobile sync`,
  });
  return { count, stats };
}

async function main() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const db = new Database(process.env.DB_PATH || path.resolve(__dirname, '../../../scraped/listings.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const makesMap = loadMobileBgMakesMapFromDb(db) ?? await fetchMakesModels().catch(() => null);
  const fuelMap = await fetchFuelTypes().catch(() => null);
  const transmissionMap = await fetchTransmissionTypes().catch(() => null);

  const dealers = db.prepare(`
    SELECT id, slug, name, cars_url as carsUrl, own, active,
           cars_user, cars_password
    FROM dealers WHERE active = 1 AND cars_url IS NOT NULL ORDER BY name
  `).all() as Record<string, unknown>[];

  const selected = requestedSlugs.length > 0 ? dealers.filter(d => requestedSlugs.includes(d.slug as string)) : dealers;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, stats } = await scrapeCarsBgForUI(dealer as Record<string, any>, db, makesMap, fuelMap, transmissionMap);
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
