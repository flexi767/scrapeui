#!/usr/bin/env node
/**
 * Scraper runner for the scrapeui web interface.
 * Emits newline-delimited JSON to stdout for SSE streaming.
 *
 * Usage: node scripts/run-for-ui.js --dealers peevauto,luxcars [--deep]
 */
const { PlaywrightCrawler } = require('crawlee');
const path = require('path');
const util = require('util');
const Database = require('better-sqlite3');
const { fetchMakesModels, parseMakeModelSync } = require('../utils/makes-models');

// Parse args
const args = process.argv.slice(2);
const dealersIdx = args.indexOf('--dealers');
const dealerArg = dealersIdx !== -1 && args[dealersIdx + 1] ? args[dealersIdx + 1] : '';
const deepCrawl = args.includes('--deep');
const requestedSlugs = dealerArg ? dealerArg.split(',').map(s => s.trim()) : [];

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function formatError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  const anyErr = err;
  const isDev = process.env.NODE_ENV !== 'production';

  if (!isDev) {
    return anyErr.message || 'Scrape failed';
  }

  if (Array.isArray(anyErr.errors) && anyErr.errors.length > 0) {
    return anyErr.errors
      .map((e) => formatError(e))
      .filter(Boolean)
      .join(' | ');
  }
  if (anyErr.cause) {
    const cause = formatError(anyErr.cause);
    if (cause && cause !== anyErr.message) return `${anyErr.message}: ${cause}`;
  }
  if (anyErr.message) return anyErr.message;
  return util.inspect(anyErr, { depth: 4, breakLength: 120 });
}

function extractMobileId(url) {
  const m = url?.match(/obiava-(\d+)/);
  return m ? m[1] : null;
}

function parseReg(yearStr) {
  if (!yearStr) return { regMonth: null, regYear: null };
  const BG_MONTHS = { 'януари':'01','февруари':'02','март':'03','април':'04','май':'05','юни':'06','юли':'07','август':'08','септември':'09','октомври':'10','ноември':'11','декември':'12' };
  const lower = String(yearStr).toLowerCase();
  const yearMatch = lower.match(/(\d{4})/);
  const regYear = yearMatch ? yearMatch[1] : null;
  let regMonth = null;
  for (const [bg, num] of Object.entries(BG_MONTHS)) {
    if (lower.includes(bg)) { regMonth = num; break; }
  }
  return { regMonth, regYear };
}

function cleanDescription(text) {
  if (!text) return '';
  const lines = String(text)
    .replace(/\r\n/g, '\n')
    .split('\n');

  const start = lines.findIndex(line => line.trim() === 'Допълнителна информация');
  const trimmed = start === -1 ? lines : lines.slice(start + 4);

  return trimmed.join('\n').trim();
}

function upsertListing(db, dealerId, listing, makesMap) {
  const now = new Date().toISOString();
  const mobileId = extractMobileId(listing.url);
  if (!mobileId) return { action: 'skip' };

  const { make, model } = parseMakeModelSync(listing.title, makesMap);
  const { regMonth, regYear } = parseReg(listing.year);
  const price = listing.price?.amount ?? null;
  const vat = listing.vat ?? null;

  const existing = db.prepare('SELECT * FROM listings WHERE mobile_id = ?').get(mobileId);
  // Only overwrite detail-page fields if we actually scraped the detail page (deep crawl)
  // Signals: images present, description present, or lastEdit set
  const isDeep = (listing.images?.meta && listing.images?.thumbKeys?.length > 0)
    || !!listing.lastEdit || !!listing.description;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const vatChanged = isDeep ? (vat !== existing.vat) : false;
    const lastEditChanged = isDeep ? ((listing.lastEdit || null) !== (existing.last_edit || null)) : false;
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const titleChanged = (listing.title || '') !== (existing.title || '');
    const descriptionChanged = isDeep ? ((listing.description || '') !== (existing.description || '')) : false;
    if (priceChanged || vatChanged || lastEditChanged || adStatusChanged || kaparoChanged || titleChanged || descriptionChanged) {
      db.prepare(`
        INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, ad_status, kaparo, title, description, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        existing.id,
        (priceChanged || vatChanged) ? existing.current_price : null,
        (priceChanged || vatChanged) ? existing.vat : null,
        lastEditChanged ? (listing.lastEdit || null) : null,
        adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged ? (listing.kaparo ? 1 : 0) : null,
        titleChanged ? (listing.title || null) : null,
        descriptionChanged ? (listing.description || null) : null,
        now,
      );
      emit({
        type: 'change',
        mobileId: mobileId,
        title: existing.title || listing.title,
        url: listing.url || existing.url,
        dealer: listing.dealer || null,
        thumb: listing.thumb || null,
        price,
        priceChanged,
        oldPrice: priceChanged ? existing.current_price : null,
        newPrice: priceChanged ? price : null,
        vatChanged,
        oldVat: vatChanged ? existing.vat : null,
        newVat: vatChanged ? (isDeep ? vat : existing.vat) : null,
        adStatusChanged,
        oldStatus: adStatusChanged ? existing.ad_status : null,
        newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged,
        titleChanged,
        descriptionChanged,
      });
    }

    const hasImages = listing.images?.meta && listing.images?.thumbKeys?.length > 0;
    const imageFields = hasImages
      ? 'image_count = ?, image_meta = ?, thumb_keys = ?, full_keys = ?,'
      : '';
    const imageValues = hasImages
      ? [listing.imageCount || 0, JSON.stringify(listing.images.meta),
         JSON.stringify(listing.images.thumbKeys), JSON.stringify(listing.images.fullKeys || [])]
      : [];

    const priceChangeDelta = priceChanged ? price - existing.current_price : existing.price_change ?? null;

    db.prepare(`
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, reg_month = ?, reg_year = ?,
        fuel = ?, color = ?, power = ?, mileage = ?, description = ?, ad_status = ?, kaparo = ?,
        is_new = ?, last_edit = ?, current_price = ?, vat = ?, price_change = ?, ${imageFields}
        last_seen_at = ?, is_active = 1
      WHERE id = ?
    `).run(
      dealerId, listing.url, listing.title, make, model,
      isDeep ? regMonth : existing.reg_month,
      isDeep ? regYear : existing.reg_year,
      isDeep ? (listing.fuel || null) : existing.fuel,
      isDeep ? (listing.color || null) : existing.color,
      isDeep ? (listing.power || null) : existing.power,
      isDeep ? (listing.mileage || null) : existing.mileage,
      isDeep ? (listing.description || null) : existing.description,
      listing.adStatus || existing.ad_status || 'none', listing.kaparo ? 1 : 0,
      isDeep ? (listing.isNew ? 1 : 0) : existing.is_new,
      isDeep ? (listing.lastEdit || null) : existing.last_edit,
      price,
      isDeep ? vat : (existing.vat ?? null),
      priceChangeDelta,
      ...imageValues,
      now, existing.id
    );
    return { action: 'updated', snapshot: priceChanged || vatChanged };
  }

  const result = db.prepare(`
    INSERT INTO listings (
      mobile_id, dealer_id, url, title, make, model, reg_month, reg_year,
      fuel, color, power, mileage, description, ad_status, kaparo, is_new,
      last_edit, current_price, vat, image_count, image_meta, thumb_keys, full_keys,
      images_downloaded, first_seen_at, last_seen_at, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 1)
  `).run(
    mobileId, dealerId, listing.url, listing.title, make, model, regMonth, regYear,
    listing.fuel || null, listing.color || null, listing.power || null, listing.mileage || null,
    listing.description || null, listing.adStatus || 'none', listing.kaparo ? 1 : 0, listing.isNew ? 1 : 0,
    listing.lastEdit || null, price, vat, listing.imageCount || 0,
    listing.images?.meta ? JSON.stringify(listing.images.meta) : null,
    listing.images?.thumbKeys ? JSON.stringify(listing.images.thumbKeys) : null,
    listing.images?.fullKeys ? JSON.stringify(listing.images.fullKeys) : null,
    now, now
  );

  return { action: 'inserted', snapshot: false };
}

async function scrapeCompetitorForUI(dealer, db, makesMap) {
  let count = 0;
  const maxPages = 20;
  const snapshotDate = new Date().toISOString().slice(0, 10);

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
            const adStatus = /\bTOP\b/i.test(itemClass) ? 'TOP'
              : /\bVIP\b/i.test(itemClass) ? 'VIP'
              : 'none';
            const kaparo = !!(a.closest('.kaparo') || item?.querySelector('.kaparo') || item?.classList?.contains('kaparo'));
            // Find first real photo — skip SVG icons
            const allImgs = Array.from(item?.querySelectorAll('img') || []);
            const thumbImg = allImgs.find(i => {
              const src = i.src || i.getAttribute('data-src') || '';
              return src && !src.endsWith('.svg') && src.includes('photosorg');
            });
            return {
              url: a.href,
              title: a.textContent?.trim() || '',
              priceText: priceEl?.textContent?.trim() || '',
              adStatus,
              kaparo,
              thumb: thumbImg?.src || thumbImg?.getAttribute('data-src') || '',
            };
          }).filter(c => c.url.includes('/obiava-'))
        );

        if (deepCrawl) {
          for (const card of cards) {
            await crawler.addRequests([{
              url: card.url,
              label: 'DETAIL',
              userData: card,
            }]);
          }
        } else {
          // Shallow mode: emit from list page data only
          for (const card of cards) {
            const priceMatch = card.priceText.replace(/\s/g, '').match(/([\d.,]+)€/);
            const priceAmount = priceMatch ? Math.round(parseFloat(priceMatch[1].replace(',', ''))) : null;
            const listing = {
              url: card.url,
              title: card.title,
              adStatus: card.adStatus,
              kaparo: card.kaparo,
              thumb: card.thumb || '',
              price: { amount: priceAmount, currency: 'EUR' },
              vat: null,
              lastEdit: null,
              isNew: false,
              imageCount: 0,
              images: { meta: null, thumbKeys: [], fullKeys: [] },
              scrapedAt: new Date().toISOString(),
              source: 'mobile.bg',
              dealer: dealer.slug,
              snapshotDate,
            };
            const result = upsertListing(db, dealer.id, listing, makesMap);
            count++;
            emit({
              type: 'listing',
              dealer: dealer.slug,
              title: card.title,
              price: priceAmount,
              url: card.url,
              thumb: card.thumb || '',
              newListing: result.action === 'inserted',
              imageCount: 0,
            });
          }
        }

        // Pagination
        const currentPage = parseInt(new URL(url).searchParams.get('page') || '1', 10);
        if (currentPage < maxPages) {
          const hasNext = await page.evaluate((cp) =>
            Array.from(document.querySelectorAll('a')).some(a =>
              a.href.includes(`page=${cp + 1}`) || a.textContent?.trim() === String(cp + 1)
            ), currentPage
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
          const statistikiText = document.querySelector('.statistiki')?.innerText?.trim() || '';
          const description = document.querySelector('.moreInfo')?.innerText?.trim() || '';
          const thumbUrls = Array.from(document.querySelectorAll('.smallPicturesGallery img'))
            .map(img => img.src).filter(Boolean);
          const fullUrls = [...new Set(
            Array.from(document.querySelectorAll('.carouselimg, [class*=carousel] img'))
              .map(img => img.src || img.getAttribute('data-src') || '')
              .filter(s => s.includes('/big1/') && s.includes('.webp'))
          )];
          const parseImgUrl = (url) => {
            const m = url.match(/^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/);
            return m ? { cdn: m[1], shard: m[2], key: m[3] } : null;
          };
          const firstThumb = thumbUrls[0] ? parseImgUrl(thumbUrls[0]) : null;
          const imgMeta = firstThumb ? { cdn: firstThumb.cdn, shard: firstThumb.shard } : null;
          const thumbKeys = thumbUrls.map(u => parseImgUrl(u)?.key).filter(Boolean);
          const fullKeys = fullUrls.map(u => parseImgUrl(u)?.key).filter(Boolean);
          return {
            priceText, vatText,
            bodyText: document.body.innerText.substring(0, 5000),
            statistikiText, description,
            imgMeta, thumbKeys, fullKeys,
            firstThumbUrl: thumbUrls[0] || '',
          };
        });

        const euroMatch = raw.priceText.replace(/\s/g, '').match(/([\d.,]+)€/);
        const priceAmount = euroMatch ? Math.round(parseFloat(euroMatch[1].replace(',', ''))) : null;
        const currency = euroMatch ? 'EUR' : (raw.priceText.includes('лв') ? 'BGN' : 'EUR');

        const vatLower = raw.vatText.toLowerCase();
        let vat = null;
        if (vatLower.includes('освободена') || vatLower.includes('частна') || vatLower.includes('не се начислява')) vat = 'exempt';
        else if (vatLower.includes('с включено ддс') || vatLower.includes('с ддс') || vatLower.includes('вкл')) vat = 'included';
        else if (vatLower.includes('без ддс')) vat = 'excluded';

        const extract = (label) => {
          const m = raw.bodyText.match(new RegExp(label + '\\s*\\n\\s*(.+)'));
          return m ? m[1].trim() : null;
        };
        const mileageRaw = extract('Пробег \\[км\\]');
        const powerRaw = extract('Мощност');

        let lastEdit = null;
        let isNew = false;
        if (raw.statistikiText) {
          const isEdited = raw.statistikiText.startsWith('Редактирана');
          isNew = !isEdited;
          const dateMatch = raw.statistikiText.match(/(\d{2})\.(\d{2})\.(\d{4})/);
          const timeMatch = raw.statistikiText.match(/(\d{2}:\d{2})/);
          if (dateMatch) {
            const [, dd, mm, yyyy] = dateMatch;
            const time = timeMatch ? timeMatch[1] : '00:00';
            lastEdit = `${yyyy}-${mm}-${dd} ${time}`;
          }
        }

        const listing = {
          url,
          title: request.userData?.title || '',
          adStatus: request.userData?.adStatus || 'none',
          kaparo: request.userData?.kaparo || false,
          thumb: raw.firstThumbUrl || request.userData?.thumb || '',
          price: { amount: priceAmount, currency },
          vat,
          lastEdit,
          isNew,
          year: extract('Дата на производство'),
          mileage: mileageRaw ? parseInt(mileageRaw.replace(/\D/g, ''), 10) || null : null,
          color: extract('Цвят'),
          fuel: extract('Двигател'),
          power: powerRaw ? parseInt(powerRaw.match(/(\d+)/)?.[1] || '', 10) || null : null,
          description: cleanDescription(raw.description),
          imageCount: raw.thumbKeys.length,
          images: {
            meta: raw.imgMeta,
            thumbKeys: raw.thumbKeys,
            fullKeys: raw.fullKeys,
          },
          scrapedAt: new Date().toISOString(),
          source: 'mobile.bg',
          dealer: dealer.slug,
          snapshotDate,
        };
        const result = upsertListing(db, dealer.id, listing, makesMap);
        count++;
        emit({
          type: 'listing',
          dealer: dealer.slug,
          title: listing.title,
          price: priceAmount,
          url,
          thumb: raw.firstThumbUrl || request.userData?.thumb || '',
          newListing: result.action === 'inserted',
          imageCount: raw.thumbKeys.length,
        });
      }
    },
  });

  await crawler.run([{ url: dealer.mobileBg, label: 'LIST' }]);
  return count;
}

async function main() {
  const db = new Database(path.resolve(__dirname, '../../../scraped/listings.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const makesMap = await fetchMakesModels().catch(() => null);
  const dealers = db.prepare(`
    SELECT id, slug, name, mobile_url as mobileBg, own, active
    FROM dealers
    WHERE active = 1 AND mobile_url IS NOT NULL
    ORDER BY name
  `).all();
  const selected = requestedSlugs.length > 0
    ? dealers.filter(d => requestedSlugs.includes(d.slug))
    : dealers;

  if (selected.length === 0) {
    emit({ type: 'error', message: 'No matching dealers found' });
    process.exit(1);
  }

  let hadErrors = false;

  for (const dealer of selected) {
    emit({ type: 'log', message: `Starting scrape: ${dealer.name}` });
    try {
      const count = await scrapeCompetitorForUI(dealer, db, makesMap);
      emit({ type: 'done', dealer: dealer.slug, count });
    } catch (err) {
      hadErrors = true;
      emit({ type: 'error', message: `Error scraping ${dealer.name}: ${formatError(err)}` });
    }
  }

  if (!hadErrors) {
    emit({ type: 'seeded', message: 'Data saved' });
  }
  db.close();
}

main().catch(err => {
  emit({ type: 'error', message: formatError(err) });
  process.exit(1);
});
