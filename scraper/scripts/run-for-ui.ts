#!/usr/bin/env tsx
/**
 * Scraper runner for the scrapeui web interface.
 * Emits newline-delimited JSON to stdout for SSE streaming.
 *
 * Usage: tsx scripts/run-for-ui.ts --dealers peevauto,luxcars [--deep]
 */
import { PlaywrightCrawler } from 'crawlee';
import path from 'path';
import { fileURLToPath } from 'url';
import util from 'util';
import Database from 'better-sqlite3';
import { fetchMakesModels, parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { resolveCarsBgMakeModelIds } from '@/lib/cars-bg/makes-models';
import { fetchFuelTypes, normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { fetchTransmissionTypes, normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';
import { getBodyTypeMap, normalizeBodyTypeSync } from '@/lib/mobile-bg/body-types';
import { reconcileDeletedMobileBgListings } from '@/lib/mobile-bg/reconcile-deleted';
import { saveListingThumb } from '@/lib/listing-thumbs';

// Parse args
const args = process.argv.slice(2);
const dealersIdx = args.indexOf('--dealers');
const dealerArg = dealersIdx !== -1 && args[dealersIdx + 1] ? args[dealersIdx + 1] : '';
const deepCrawl = args.includes('--deep');
const requestedSlugs = dealerArg ? dealerArg.split(',').map(s => s.trim()) : [];
const HOMEPAGE_CATEGORY_OPTIONS = new Set(['Ван', 'Джип', 'Кабрио', 'Комби', 'Купе', 'Миниван', 'Пикап', 'Седан', 'Стреч лимузина', 'Хечбек']);

function emit(obj: object) {
  process.stdout.write(JSON.stringify(obj) + '\n');
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

function extractMobileId(url: string): string | null {
  const m = url?.match(/obiava-(\d+)/);
  return m ? m[1] : null;
}

function normalizeMobileDetailUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.mobile.bg') && parsed.hostname !== 'www.mobile.bg') {
      parsed.hostname = 'www.mobile.bg';
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseReg(yearStr: string | null): { regMonth: string | null; regYear: string | null } {
  if (!yearStr) return { regMonth: null, regYear: null };
  const BG_MONTHS: Record<string, string> = { 'януари': '01', 'февруари': '02', 'март': '03', 'април': '04', 'май': '05', 'юни': '06', 'юли': '07', 'август': '08', 'септември': '09', 'октомври': '10', 'ноември': '11', 'декември': '12' };
  const lower = String(yearStr).toLowerCase();
  const yearMatch = lower.match(/(\d{4})/);
  const regYear = yearMatch ? yearMatch[1] : null;
  let regMonth: string | null = null;
  for (const [bg, num] of Object.entries(BG_MONTHS)) {
    if (lower.includes(bg)) { regMonth = num; break; }
  }
  return { regMonth, regYear };
}

function cleanDescription(text: string | null): string {
  if (!text) return '';
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex(line => line.trim() === 'Допълнителна информация');
  const trimmed = start === -1 ? lines : lines.slice(start + 4);
  return trimmed.join('\n').trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertListing(db: Database.Database, dealerId: number, listing: Record<string, any>, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
  const now = new Date().toISOString();
  const mobileId = extractMobileId(listing.url);
  if (!mobileId) return { action: 'skip', title: listing.title || '', make: '', model: '' };

  const rawTitle = listing.title || '';
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } = parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || '').trim();
  const { carsMakeId, carsModelId } = await resolveCarsBgMakeModelIds({ title: rawTitle, make, model }).catch(() => ({ carsMakeId: null, carsModelId: null }));
  const { regMonth, regYear } = parseReg(listing.year);
  const fuel = normalizeFuelSync(listing.fuel, fuelMap);
  const bodyType = normalizeBodyTypeSync(listing.bodyType, getBodyTypeMap());
  const transmission = normalizeTransmissionSync(listing.transmission, transmissionMap);
  const vin: string | null = listing.vin ?? null;
  const extrasJson: string | null = listing.extras ? JSON.stringify(listing.extras) : null;
  const price: number | null = listing.price?.amount ?? null;
  const vat: string | null = listing.vat ?? null;
  const views: number | null = listing.views ?? null;
  const hasOverviewSpecs = Boolean(listing.year || listing.mileage != null || listing.fuel || listing.bodyType || listing.transmission || listing.vat);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = db.prepare('SELECT * FROM listings WHERE mobile_id = ?').get(mobileId) as Record<string, any> | undefined;
  let thumbSaved = existing?.thumb_saved === 1;
  if (!thumbSaved && listing.thumb) {
    try {
      thumbSaved = Boolean(await saveListingThumb(mobileId, listing.thumb));
    } catch {
      thumbSaved = false;
    }
  }
  const isDeep = (listing.images?.meta && listing.images?.thumbKeys?.length > 0) || !!listing.lastEdit || !!listing.description;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const vatChanged = vat != null ? (vat !== existing.vat) : false;
    const lastEditChanged = isDeep ? ((listing.lastEdit || null) !== (existing.last_edit || null)) : false;
    const viewsChanged = isDeep ? (views !== (existing.views ?? null)) : false;
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const titleChanged = normalizedTitle !== (existing.title || '');
    const descriptionChanged = isDeep ? ((listing.description || '') !== (existing.description || '')) : false;

    if (priceChanged || vatChanged || lastEditChanged || viewsChanged || adStatusChanged || kaparoChanged || titleChanged || descriptionChanged) {
      db.prepare(`
        INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        (priceChanged || vatChanged) ? existing.current_price : null,
        (priceChanged || vatChanged) ? existing.vat : null,
        lastEditChanged ? (listing.lastEdit || null) : null,
        viewsChanged ? views : null,
        adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged ? (listing.kaparo ? 1 : 0) : null,
        titleChanged ? (normalizedTitle || null) : null,
        descriptionChanged ? (listing.description || null) : null,
        now,
      );
      emit({
        type: 'change', mobileId, make, model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null, thumb: listing.thumb || null, price,
        priceChanged, oldPrice: priceChanged ? existing.current_price : null, newPrice: priceChanged ? price : null,
        vatChanged, oldVat: vatChanged ? existing.vat : null, newVat: vatChanged ? (isDeep ? vat : existing.vat) : null,
        viewsChanged, oldViews: viewsChanged ? (existing.views ?? null) : null, newViews: viewsChanged ? views : null,
        adStatusChanged, oldStatus: adStatusChanged ? existing.ad_status : null, newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged, titleChanged, descriptionChanged,
      });
    }

    const hasImages = listing.images?.meta && listing.images?.thumbKeys?.length > 0;
    const imageFields = hasImages ? 'image_count = ?, image_meta = ?, thumb_keys = ?, full_keys = ?,' : '';
    const imageValues = hasImages
      ? [listing.imageCount || 0, JSON.stringify(listing.images.meta), JSON.stringify(listing.images.thumbKeys), JSON.stringify(listing.images.fullKeys || [])]
      : [];
    const priceChangeDelta = priceChanged ? price! - existing.current_price : existing.price_change ?? null;

    db.prepare(`
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ?, cars_make_id = ?, cars_model_id = ?, reg_month = ?, reg_year = ?,
        fuel = ?, body_type = ?, transmission = ?, color = ?, vin = ?, power = ?, mileage = ?, description = ?, extras_json = ?, ad_status = ?, kaparo = ?,
        is_new = ?, last_edit = ?, views = ?, current_price = ?, vat = ?, price_change = ?, ${imageFields}
        last_seen_at = ?, is_active = 1, deleted_at = NULL, thumb_saved = ?
      WHERE id = ?
    `).run(
      dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId, carsMakeId, carsModelId,
      (isDeep || hasOverviewSpecs) && regMonth ? regMonth : existing.reg_month,
      (isDeep || hasOverviewSpecs) && regYear ? regYear : existing.reg_year,
      (isDeep || hasOverviewSpecs) && fuel ? fuel : existing.fuel,
      (isDeep || hasOverviewSpecs) && bodyType ? bodyType : (existing.body_type || bodyType || null),
      (isDeep || hasOverviewSpecs) && transmission ? transmission : existing.transmission,
      isDeep ? (listing.color || null) : existing.color,
      isDeep ? vin : (existing.vin ?? null),
      isDeep ? (listing.power || null) : existing.power,
      (isDeep || hasOverviewSpecs) && listing.mileage != null ? listing.mileage : existing.mileage,
      isDeep ? (listing.description || null) : existing.description,
      isDeep ? extrasJson : (existing.extras_json ?? null),
      listing.adStatus || existing.ad_status || 'none', listing.kaparo ? 1 : 0,
      isDeep ? (listing.isNew ? 1 : 0) : existing.is_new,
      isDeep ? (listing.lastEdit || null) : existing.last_edit,
      isDeep ? views : (existing.views ?? null),
      price, vat != null ? vat : (existing.vat ?? null), priceChangeDelta,
      ...imageValues, now, thumbSaved ? 1 : (existing.thumb_saved ?? 0), existing.id
    );
    return { action: 'updated', snapshot: priceChanged || vatChanged, title: normalizedTitle, make, model };
  }

  db.prepare(`
    INSERT INTO listings (
      mobile_id, dealer_id, url, title, make, model, mobile_make_id, mobile_model_id, cars_make_id, cars_model_id, reg_month, reg_year,
      fuel, body_type, transmission, color, vin, power, mileage, description, extras_json, ad_status, kaparo, is_new,
      last_edit, views, current_price, vat, image_count, image_meta, thumb_keys, full_keys,
      images_downloaded, thumb_saved, first_seen_at, last_seen_at, is_active, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, NULL)
  `).run(
    mobileId, dealerId, listing.url, normalizedTitle, make, model, mobileMakeId, mobileModelId, carsMakeId, carsModelId, regMonth, regYear,
    fuel || null, bodyType || null, transmission || null, listing.color || null, vin, listing.power || null, listing.mileage || null,
    listing.description || null, extrasJson, listing.adStatus || 'none', listing.kaparo ? 1 : 0, listing.isNew ? 1 : 0,
    listing.lastEdit || null, views, price, vat, listing.imageCount || 0,
    listing.images?.meta ? JSON.stringify(listing.images.meta) : null,
    listing.images?.thumbKeys ? JSON.stringify(listing.images.thumbKeys) : null,
    listing.images?.fullKeys ? JSON.stringify(listing.images.fullKeys) : null,
    thumbSaved ? 1 : 0, now, now
  );
  return { action: 'inserted', snapshot: false, title: normalizedTitle, make, model };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scrapeCompetitorForUI(dealer: Record<string, any>, db: Database.Database, makesMap: MakesMap | null, fuelMap: Map<string, string> | null, transmissionMap: Map<string, string> | null) {
  let count = 0;
  const maxPages = 20;
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const seenMobileIds = new Set<string>();

  const crawler = new PlaywrightCrawler({
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    headless: true,
    maxConcurrency: 3,

    async requestHandler({ page, request }) {
      const url = request.url;

      if (request.label === 'LIST' || !request.label) {
        await page.waitForSelector('a.title', { timeout: 15000 }).catch(() => {});

        const cards = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a.title')).map(a => {
            const card = a.closest('.zaglavie') || a.parentElement;
            const item = a.closest('[class*="item"]') || card?.closest('[class*="item"]');
            const itemClass = item?.className || '';
            const priceEl = card?.querySelector('.price');
            const priceWrapText = (priceEl?.parentElement?.textContent || item?.textContent || '').trim();
            const params = Array.from(item?.querySelectorAll('.params span') || [])
              .map(span => span.textContent?.trim() || '')
              .filter(Boolean);
            const transmissionOptions = ['Ръчна', 'Автоматична', 'Полуавтоматична'];
            const transmissionIndex = params.findIndex(value => transmissionOptions.includes(value));
            const year = params.find(value => /\d{4}/.test(value)) || null;
            const mileage = params.find(value => /км/i.test(value)) || null;
            const fuel = params.find(value => /(бенз|дизел|electric|електр|хибрид|газ|метан)/i.test(value)) || null;
            const transmission = transmissionIndex !== -1 ? params[transmissionIndex] : null;
            const bodyType = params.find(value => ['Ван', 'Джип', 'Кабрио', 'Комби', 'Купе', 'Миниван', 'Пикап', 'Седан', 'Стреч лимузина', 'Хечбек'].includes(value)) || (transmissionIndex !== -1 ? (params[transmissionIndex + 1] || null) : null);
            const vatText = /без ддс/i.test(priceWrapText)
              ? 'без ДДС'
              : /с включено ддс|с ддс|вкл\.?\s*ддс/i.test(priceWrapText)
              ? 'с ДДС'
              : /не се начислява ддс|частно лице|освободена/i.test(priceWrapText)
              ? 'не се начислява ДДС'
              : null;
            const adStatus = /\bTOP\b/i.test(itemClass) ? 'TOP' : /\bVIP\b/i.test(itemClass) ? 'VIP' : 'none';
            const kaparo = !!(a.closest('.kaparo') || item?.querySelector('.kaparo') || item?.classList?.contains('kaparo'));
            const allImgs = Array.from(item?.querySelectorAll('img') || []);
            const thumbImg = allImgs.find(i => {
              const src = (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src || i.getAttribute('data-src') || i.getAttribute('data-lazy') || i.getAttribute('data-srcset') || i.getAttribute('srcset') || '';
              return src && !src.endsWith('.svg') && src.includes('photosorg');
            }) as HTMLImageElement | undefined;
            const thumb =
              thumbImg?.currentSrc ||
              thumbImg?.src ||
              thumbImg?.getAttribute('data-src') ||
              thumbImg?.getAttribute('data-lazy') ||
              thumbImg?.getAttribute('data-srcset')?.split(',')[0]?.trim().split(' ')[0] ||
              thumbImg?.getAttribute('srcset')?.split(',')[0]?.trim().split(' ')[0] ||
              '';
            return {
              url: (a as HTMLAnchorElement).href,
              title: a.textContent?.trim() || '',
              priceText: priceEl?.textContent?.trim() || '',
              vatText,
              year,
              mileage,
              fuel,
              transmission,
              adStatus, kaparo,
              bodyType,
              thumb,
            };
          }).filter(c => c.url.includes('/obiava-'))
        );

        for (const card of cards) {
          const mobileId = extractMobileId(card.url);
          if (mobileId) seenMobileIds.add(mobileId);
        }

        if (deepCrawl) {
          for (const card of cards) {
            await crawler.addRequests([{
              url: normalizeMobileDetailUrl(card.url),
              label: 'DETAIL',
              userData: {
                ...card,
                originalUrl: card.url,
              },
            }]);
          }
        } else {
          for (const card of cards) {
            const priceMatch = card.priceText.replace(/\s/g, '').match(/([\d.,]+)€/);
            const priceAmount = priceMatch ? Math.round(parseFloat(priceMatch[1].replace(',', ''))) : null;
            const bodyType = card.bodyType && HOMEPAGE_CATEGORY_OPTIONS.has(card.bodyType) ? card.bodyType : null;
            const vatLower = (card.vatText || '').toLowerCase();
            let vat: string | null = null;
            if (vatLower.includes('не се начислява') || vatLower.includes('частно лице') || vatLower.includes('освободена')) vat = 'exempt';
            else if (vatLower.includes('с ддс') || vatLower.includes('вкл')) vat = 'included';
            else if (vatLower.includes('без ддс')) vat = 'excluded';
            const listing = {
              url: card.url, title: card.title, adStatus: card.adStatus, kaparo: card.kaparo,
              bodyType,
              year: card.year || null,
              mileage: card.mileage ? parseInt(String(card.mileage).replace(/\D/g, ''), 10) || null : null,
              fuel: card.fuel || null,
              transmission: card.transmission || null,
              thumb: card.thumb || '', price: { amount: priceAmount, currency: 'EUR' },
              vat, lastEdit: null, isNew: false, imageCount: 0,
              images: { meta: null, thumbKeys: [], fullKeys: [] },
              scrapedAt: new Date().toISOString(), source: 'mobile.bg', dealer: dealer.slug, snapshotDate,
            };
            const result = await upsertListing(db, dealer.id, listing, makesMap, fuelMap, transmissionMap);
            count++;
            emit({ type: 'listing', dealer: dealer.slug, make: result.make, model: result.model, title: result.title, price: priceAmount, url: card.url, thumb: card.thumb || '', newListing: result.action === 'inserted', imageCount: 0 });
          }
        }

        const currentPage = parseInt(new URL(url).searchParams.get('page') || '1', 10);
        if (currentPage < maxPages) {
          const hasNext = await page.evaluate((cp: number) =>
            Array.from(document.querySelectorAll('a')).some(a => a.href.includes(`page=${cp + 1}`) || a.textContent?.trim() === String(cp + 1)),
            currentPage
          );
          if (hasNext) {
            const nextUrl = new URL(dealer.mobileBg);
            nextUrl.searchParams.set('page', String(currentPage + 1));
            await crawler.addRequests([{ url: nextUrl.toString(), label: 'LIST' }]);
          }
        }
      }

      if (request.label === 'DETAIL') {
        await page.waitForSelector('.Price, .disp', { timeout: 15000 }).catch(() => {});

        const raw = await page.evaluate(() => {
          const priceEl = document.querySelector('.Price');
          const priceText = (priceEl?.innerHTML || '').split('<br>')[0].replace(/<[^>]+>/g, '').trim();
          const vatText = document.querySelector('.PriceInfo')?.textContent?.trim() || '';
          const statistikiText = (document.querySelector('.statistiki') as HTMLElement)?.innerText?.trim() || '';
          const description = (document.querySelector('.moreInfo') as HTMLElement)?.innerText?.trim() || '';
          const thumbUrls = Array.from(document.querySelectorAll('.smallPicturesGallery img')).map(img => (img as HTMLImageElement).src).filter(Boolean);
          const fullUrls = [...new Set(
            Array.from(document.querySelectorAll('.carouselimg, [class*=carousel] img'))
              .map(img => (img as HTMLImageElement).src || img.getAttribute('data-src') || '')
              .filter(s => s.includes('/big1/') && s.includes('.webp'))
          )];
          const parseImgUrl = (u: string) => {
            const m = u.match(/^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/);
            return m ? { cdn: m[1], shard: m[2], key: m[3] } : null;
          };
          const firstThumb = thumbUrls[0] ? parseImgUrl(thumbUrls[0]) : null;
          const imgMeta = firstThumb ? { cdn: firstThumb.cdn, shard: firstThumb.shard } : null;
          const thumbKeys = thumbUrls.map(u => parseImgUrl(u)?.key).filter(Boolean) as string[];
          const fullKeys = fullUrls.map(u => parseImgUrl(u)?.key).filter(Boolean) as string[];
          return { priceText, vatText, bodyText: document.body.innerText.substring(0, 5000), statistikiText, description, imgMeta, thumbKeys, fullKeys, firstThumbUrl: thumbUrls[0] || '' };
        });

        const euroMatch = raw.priceText.replace(/\s/g, '').match(/([\d.,]+)€/);
        const priceAmount = euroMatch ? Math.round(parseFloat(euroMatch[1].replace(',', ''))) : null;

        const vatLower = raw.vatText.toLowerCase();
        let vat: string | null = null;
        if (vatLower.includes('освободена') || vatLower.includes('частна') || vatLower.includes('не се начислява')) vat = 'exempt';
        else if (vatLower.includes('с включено ддс') || vatLower.includes('с ддс') || vatLower.includes('вкл')) vat = 'included';
        else if (vatLower.includes('без ддс')) vat = 'excluded';

        const extract = (label: string) => {
          const m = raw.bodyText.match(new RegExp(label + '\\s*\\n\\s*(.+)'));
          return m ? m[1].trim() : null;
        };
        
        // Extract with additional validation to prevent capturing multiple fields
        const extractSingleWord = (label: string) => {
          const raw_value = extract(label);
          if (!raw_value) return null;
          // For single-word fields like body type, only keep the first word and reject if it contains digits or brackets
          const firstWord = raw_value.split(/[\s\[\](\n]/)[0];
          if (!firstWord || /\d/.test(firstWord)) return null;
          return firstWord;
        };
        
        const mileageRaw = extract('Пробег \\[км\\]');
        const powerRaw = extract('Мощност');
        const vinRaw = extract('VIN номер');
        const extras = Array.from(document.querySelectorAll('.carExtri .items div'))
          .map((el) => el.textContent?.trim() || '')
          .filter(Boolean);

        let lastEdit: string | null = null;
        let views: number | null = null;
        let isNew = false;
        if (raw.statistikiText) {
          isNew = !raw.statistikiText.startsWith('Редактирана');
          const dateMatch = raw.statistikiText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          const timeMatch = raw.statistikiText.match(/(\d{2}:\d{2})/);
          const viewsMatch = raw.statistikiText.match(/Прегледана:\s*(\d+)/i);
          if (dateMatch) {
            const [, dd, mm, yyyy] = dateMatch;
            lastEdit = `${yyyy}-${mm}-${dd} ${timeMatch ? timeMatch[1] : '00:00'}`;
          }
          views = viewsMatch ? parseInt(viewsMatch[1], 10) || null : null;
        }

        const listing = {
          url: request.userData?.originalUrl || url, title: request.userData?.title || '', adStatus: request.userData?.adStatus || 'none',
          kaparo: request.userData?.kaparo || false, thumb: raw.firstThumbUrl || request.userData?.thumb || '',
          price: { amount: priceAmount, currency: 'EUR' }, vat, lastEdit, views, isNew,
          year: extract('Дата на производство'),
          mileage: mileageRaw ? parseInt(mileageRaw.replace(/\D/g, ''), 10) || null : null,
          color: extract('Цвят'), fuel: extract('Двигател'),
          vin: vinRaw ? vinRaw.split(/\s+/)[0] : null,
          extras,
          bodyType: extractSingleWord('Категория'), transmission: extract('Скоростна кутия'),
          power: powerRaw ? parseInt(powerRaw.match(/(\d+)/)?.[1] || '', 10) || null : null,
          description: cleanDescription(raw.description),
          imageCount: raw.thumbKeys.length,
          images: { meta: raw.imgMeta, thumbKeys: raw.thumbKeys, fullKeys: raw.fullKeys },
          scrapedAt: new Date().toISOString(), source: 'mobile.bg', dealer: dealer.slug, snapshotDate,
        };
        const result = await upsertListing(db, dealer.id, listing, makesMap, fuelMap, transmissionMap);
        count++;
        emit({ type: 'listing', dealer: dealer.slug, make: result.make, model: result.model, title: result.title, price: priceAmount, url, thumb: raw.firstThumbUrl || request.userData?.thumb || '', newListing: result.action === 'inserted', imageCount: raw.thumbKeys.length });
      }
    },
  });

  await crawler.run([{ url: dealer.mobileBg, label: 'LIST' }]);
  const reconciliation = reconcileDeletedMobileBgListings(db, dealer.id as number, seenMobileIds);
  emit({
    type: 'log',
    message: `Reconciled live mobile.bg listings for ${dealer.slug}: reactivated ${reconciliation.reactivatedCount}, marked ${reconciliation.deletedCount} deleted`,
  });
  return count;
}

async function main() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const db = new Database(process.env.DB_PATH || path.resolve(__dirname, '../../../scraped/listings.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const makesMap = await fetchMakesModels().catch(() => null);
  const fuelMap = await fetchFuelTypes().catch(() => null);
  const transmissionMap = await fetchTransmissionTypes().catch(() => null);

  const dealers = db.prepare(`
    SELECT id, slug, name, mobile_url as mobileBg, own, active,
           mobile_user, mobile_password, cars_url, cars_user, cars_password
    FROM dealers WHERE active = 1 AND mobile_url IS NOT NULL ORDER BY name
  `).all() as Record<string, unknown>[];

  const selected = requestedSlugs.length > 0 ? dealers.filter(d => requestedSlugs.includes(d.slug as string)) : dealers;

  if (selected.length === 0) {
    emit({ type: 'error', message: 'No matching dealers found' });
    process.exit(1);
  }

  let hadErrors = false;
  for (const dealer of selected) {
    emit({ type: 'log', message: `Starting scrape: ${dealer.name}` });
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await scrapeCompetitorForUI(dealer as Record<string, any>, db, makesMap, fuelMap, transmissionMap);
      emit({ type: 'done', dealer: dealer.slug, count });
    } catch (err) {
      hadErrors = true;
      emit({ type: 'error', message: `Error scraping ${dealer.name}: ${formatError(err)}` });
    }
  }

  if (!hadErrors) emit({ type: 'seeded', message: 'Data saved' });
  db.close();
}

main().catch(err => {
  emit({ type: 'error', message: formatError(err) });
  process.exit(1);
});
