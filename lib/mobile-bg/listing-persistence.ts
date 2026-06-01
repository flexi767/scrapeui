import type Database from 'better-sqlite3';
import { resolveCarsBgMakeModelIds } from '@/lib/cars-bg/makes-models';
import { currentIsoTimestamp } from '@/lib/date-format';
import { saveListingThumb } from '@/lib/listing-thumbs';
import {
  getPriceChangeDelta,
  insertListingSnapshot,
  previousValueIfChanged,
} from '@/lib/listings/snapshots';
import { normalizeBodyTypeSync, getBodyTypeMap } from '@/lib/mobile-bg/body-types';
import { normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';

export interface ScrapedMobileBgListingInput {
  url: string;
  title?: string | null;
  adStatus?: string | null;
  kaparo?: boolean | number | null;
  bodyType?: string | null;
  color?: string | null;
  year?: string | null;
  euronorm?: number | null;
  mileage?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  thumb?: string | null;
  price?: { amount?: number | null; currency?: string | null } | null;
  vat?: string | null;
  lastEdit?: string | null;
  views?: number | null;
  isNew?: boolean | number | null;
  imageCount?: number | null;
  images?: {
    meta: unknown;
    thumbKeys: string[];
    fullKeys: string[];
  } | null;
  vin?: string | null;
  extras?: unknown;
  power?: number | null;
  description?: string | null;
  scrapedAt?: string;
  source?: string;
  dealer?: string;
  snapshotDate?: string;
}

interface ExistingListingRow {
  id: number;
  url: string | null;
  title: string | null;
  description: string | null;
  current_price: number | null;
  price_change: number | null;
  vat: string | null;
  last_edit: string | null;
  views: number | null;
  ad_status: string | null;
  kaparo: number | null;
  thumb_saved: number | null;
  reg_month: string | null;
  reg_year: string | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  vin: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  extras_json: string | null;
  is_new: number | null;
}

export interface MobileBgChangeEvent {
  type: 'change';
  mobileId: string;
  make: string | null;
  model: string | null;
  title: string;
  url: string | null;
  dealer: string | null;
  thumb: string | null;
  price: number | null;
  priceChanged: boolean;
  oldPrice: number | null;
  newPrice: number | null;
  vatChanged: boolean;
  oldVat: string | null;
  newVat: string | null;
  viewsChanged: boolean;
  oldViews: number | null;
  newViews: number | null;
  adStatusChanged: boolean;
  oldStatus: string | null;
  newStatus: string | null;
  kaparoChanged: boolean;
  titleChanged: boolean;
  descriptionChanged: boolean;
}

export interface MobileBgUpsertResult {
  action: 'skip' | 'updated' | 'inserted';
  snapshot: boolean;
  title: string;
  make: string | null;
  model: string | null;
  changeEvent?: MobileBgChangeEvent;
}

export function extractMobileId(url: string): string | null {
  const m = url?.match(/obiava-(\d+)/);
  return m ? m[1] : null;
}

export function parseReg(yearStr: string | null): {
  regMonth: string | null;
  regYear: string | null;
} {
  if (!yearStr) return { regMonth: null, regYear: null };
  const bgMonths: Record<string, string> = {
    януари: '01',
    февруари: '02',
    март: '03',
    април: '04',
    май: '05',
    юни: '06',
    юли: '07',
    август: '08',
    септември: '09',
    октомври: '10',
    ноември: '11',
    декември: '12',
  };
  const lower = String(yearStr).toLowerCase();
  const yearMatch = lower.match(/(\d{4})/);
  const regYear = yearMatch ? yearMatch[1] : null;
  let regMonth: string | null = null;
  for (const [bg, num] of Object.entries(bgMonths)) {
    if (lower.includes(bg)) {
      regMonth = num;
      break;
    }
  }
  return { regMonth, regYear };
}

export async function upsertMobileBgListing(
  db: Database.Database,
  dealerId: number,
  listing: ScrapedMobileBgListingInput,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
): Promise<MobileBgUpsertResult> {
  const now = currentIsoTimestamp();
  const mobileId = extractMobileId(listing.url);
  if (!mobileId) {
    return { action: 'skip', snapshot: false, title: listing.title || '', make: '', model: '' };
  }

  const rawTitle = listing.title || '';
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } =
    parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || rawTitle).trim();
  const { carsMakeId, carsModelId } = await resolveCarsBgMakeModelIds({
    title: rawTitle,
    make,
    model,
  }).catch(() => ({ carsMakeId: null, carsModelId: null }));
  const { regMonth, regYear } = parseReg(listing.year ?? null);
  const fuel = normalizeFuelSync(listing.fuel ?? null, fuelMap);
  const bodyType = normalizeBodyTypeSync(listing.bodyType ?? null, getBodyTypeMap());
  const transmission = normalizeTransmissionSync(listing.transmission ?? null, transmissionMap);
  const vin: string | null = listing.vin ?? null;
  const euronorm: number | null = listing.euronorm ?? null;
  const extrasJson: string | null = listing.extras ? JSON.stringify(listing.extras) : null;
  const price: number | null = listing.price?.amount ?? null;
  const vat: string | null = listing.vat ?? null;
  const views: number | null = listing.views ?? null;
  const hasOverviewSpecs = Boolean(
    listing.year ||
    listing.mileage != null ||
    listing.fuel ||
    listing.bodyType ||
    listing.transmission ||
    listing.color ||
    listing.vat ||
    listing.euronorm != null,
  );

  const existing = db
    .prepare('SELECT * FROM listings WHERE mobile_id = ?')
    .get(mobileId) as ExistingListingRow | undefined;
  let thumbSaved = existing?.thumb_saved === 1;
  if (!thumbSaved && listing.thumb) {
    try {
      thumbSaved = Boolean(await saveListingThumb(mobileId, listing.thumb));
    } catch {
      thumbSaved = false;
    }
  }

  const isDeep =
    (listing.images?.meta && listing.images.thumbKeys.length > 0) ||
    !!listing.lastEdit ||
    !!listing.description;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const vatChanged = vat != null ? vat !== existing.vat : false;
    const lastEditChanged = isDeep ? (listing.lastEdit || null) !== (existing.last_edit || null) : false;
    const hadViews = existing.views != null;
    const viewsChanged = isDeep ? hadViews && views !== existing.views : false;
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const titleChanged = normalizedTitle !== (existing.title || '');
    const hadDescription = Boolean((existing.description || '').trim());
    const descriptionChanged = isDeep
      ? hadDescription && (listing.description || '') !== (existing.description || '')
      : false;
    const trackedChange =
      priceChanged ||
      vatChanged ||
      lastEditChanged ||
      viewsChanged ||
      adStatusChanged ||
      kaparoChanged ||
      titleChanged ||
      descriptionChanged;

    let changeEvent: MobileBgChangeEvent | undefined;
    if (trackedChange) {
      insertListingSnapshot(db, existing.id, {
        price: previousValueIfChanged(priceChanged, existing.current_price),
        vat: previousValueIfChanged(vatChanged, existing.vat),
        lastEdit: previousValueIfChanged(lastEditChanged, existing.last_edit || null),
        views: previousValueIfChanged(viewsChanged, existing.views),
        adStatus: previousValueIfChanged(adStatusChanged, existing.ad_status || 'none'),
        kaparo: previousValueIfChanged(kaparoChanged, existing.kaparo ? 1 : 0),
        title: previousValueIfChanged(titleChanged, existing.title || null),
        description: previousValueIfChanged(descriptionChanged, existing.description || null),
        recordedAt: now,
      });
      changeEvent = {
        type: 'change',
        mobileId,
        make,
        model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null,
        thumb: listing.thumb || null,
        price,
        priceChanged,
        oldPrice: previousValueIfChanged(priceChanged, existing.current_price),
        newPrice: priceChanged ? price : null,
        vatChanged,
        oldVat: previousValueIfChanged(vatChanged, existing.vat),
        newVat: vatChanged ? (isDeep ? vat : existing.vat) : null,
        viewsChanged,
        oldViews: previousValueIfChanged(viewsChanged, existing.views),
        newViews: viewsChanged ? views : null,
        adStatusChanged,
        oldStatus: previousValueIfChanged(adStatusChanged, existing.ad_status),
        newStatus: adStatusChanged ? listing.adStatus || 'none' : null,
        kaparoChanged,
        titleChanged,
        descriptionChanged,
      };
    }

    const imageData = listing.images?.meta && listing.images.thumbKeys.length > 0 ? listing.images : null;
    const hasImages = Boolean(imageData);
    const imageFields = hasImages ? 'image_count = ?, image_meta = ?, thumb_keys = ?, full_keys = ?,' : '';
    const imageValues = hasImages
      ? [
          listing.imageCount || 0,
          JSON.stringify(imageData!.meta),
          JSON.stringify(imageData!.thumbKeys),
          JSON.stringify(imageData!.fullKeys || []),
        ]
      : [];
    const priceChangeDelta = getPriceChangeDelta({
      priceChanged,
      newPrice: price,
      oldPrice: existing.current_price,
      existingPriceChange: existing.price_change,
      missingOldPriceAsZero: true,
    });

    db.prepare(`
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ?, cars_make_id = ?, cars_model_id = ?, reg_month = ?, reg_year = ?,
        fuel = ?, body_type = ?, transmission = ?, color = ?, vin = ?, euronorm = ?, power = ?, mileage = ?, description = ?, extras_json = ?, ad_status = ?, kaparo = ?,
        is_new = ?, last_edit = ?, views = ?, current_price = ?, vat = ?, price_change = ?, ${imageFields}
        last_seen_at = ?, is_active = 1, deleted_at = NULL, thumb_saved = ?
      WHERE id = ?
    `).run(
      dealerId,
      listing.url,
      normalizedTitle,
      make,
      model,
      mobileMakeId,
      mobileModelId,
      carsMakeId,
      carsModelId,
      (isDeep || hasOverviewSpecs) && regMonth ? regMonth : existing.reg_month,
      (isDeep || hasOverviewSpecs) && regYear ? regYear : existing.reg_year,
      (isDeep || hasOverviewSpecs) && fuel ? fuel : existing.fuel,
      (isDeep || hasOverviewSpecs) && bodyType ? bodyType : existing.body_type || bodyType || null,
      (isDeep || hasOverviewSpecs) && transmission ? transmission : existing.transmission,
      (isDeep || hasOverviewSpecs) && listing.color ? listing.color : existing.color,
      isDeep ? vin : (existing.vin ?? null),
      (isDeep || hasOverviewSpecs) && euronorm != null ? euronorm : (existing.euronorm ?? null),
      isDeep ? listing.power || null : existing.power,
      (isDeep || hasOverviewSpecs) && listing.mileage != null ? listing.mileage : existing.mileage,
      isDeep ? listing.description || null : existing.description,
      isDeep ? extrasJson : (existing.extras_json ?? null),
      listing.adStatus || existing.ad_status || 'none',
      listing.kaparo ? 1 : 0,
      isDeep ? (listing.isNew ? 1 : 0) : existing.is_new,
      isDeep ? listing.lastEdit || null : existing.last_edit,
      isDeep ? views : (existing.views ?? null),
      price,
      vat != null ? vat : (existing.vat ?? null),
      priceChangeDelta,
      ...imageValues,
      now,
      thumbSaved ? 1 : (existing.thumb_saved ?? 0),
      existing.id,
    );
    return { action: 'updated', snapshot: trackedChange, title: normalizedTitle, make, model, changeEvent };
  }

  db.prepare(`
    INSERT INTO listings (
      mobile_id, dealer_id, url, title, make, model, mobile_make_id, mobile_model_id, cars_make_id, cars_model_id, reg_month, reg_year,
      fuel, body_type, transmission, color, vin, euronorm, power, mileage, description, extras_json, ad_status, kaparo, is_new,
      last_edit, views, current_price, vat, image_count, image_meta, thumb_keys, full_keys,
      images_downloaded, thumb_saved, first_seen_at, last_seen_at, is_active, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, NULL)
  `).run(
    mobileId,
    dealerId,
    listing.url,
    normalizedTitle,
    make,
    model,
    mobileMakeId,
    mobileModelId,
    carsMakeId,
    carsModelId,
    regMonth,
    regYear,
    fuel || null,
    bodyType || null,
    transmission || null,
    listing.color || null,
    vin,
    euronorm,
    listing.power || null,
    listing.mileage || null,
    listing.description || null,
    extrasJson,
    listing.adStatus || 'none',
    listing.kaparo ? 1 : 0,
    listing.isNew ? 1 : 0,
    listing.lastEdit || null,
    views,
    price,
    vat,
    listing.imageCount || 0,
    listing.images?.meta ? JSON.stringify(listing.images.meta) : null,
    listing.images?.thumbKeys ? JSON.stringify(listing.images.thumbKeys) : null,
    listing.images?.fullKeys ? JSON.stringify(listing.images.fullKeys) : null,
    thumbSaved ? 1 : 0,
    now,
    now,
  );
  return { action: 'inserted', snapshot: false, title: normalizedTitle, make, model };
}
