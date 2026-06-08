import type Database from 'better-sqlite3';
import { resolveCarsBgMakeModelIds } from '@/lib/cars-bg/makes-models';
import { currentIsoTimestamp } from '@/lib/date-format';
import { saveListingThumb } from '@/lib/listing-thumbs';
import {
  buildListingSnapshotPayload,
  getPriceChangeDelta,
  hasListingSnapshotChanges,
  insertListingSnapshot,
  previousValueIfChanged,
} from '@/lib/listings/snapshots';
import { normalizeListingSpecs } from '@/lib/listings/normalize';
import { booleanFlag, priceChanged as hasPriceChanged } from '@/lib/listings/persistence-utils';
import { runInsert, runUpdate, type ColumnValues } from '@/lib/listings/sql';
import { type MakesMap } from '@/lib/mobile-bg/makes-models';

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
  const { make, model, mobileMakeId, mobileModelId, normalizedTitle, fuel, bodyType, transmission } =
    normalizeListingSpecs(
      rawTitle,
      {
        fuel: listing.fuel ?? null,
        bodyType: listing.bodyType ?? null,
        transmission: listing.transmission ?? null,
      },
      { makesMap, fuelMap, transmissionMap },
    );
  const { carsMakeId, carsModelId } = await resolveCarsBgMakeModelIds({
    title: rawTitle,
    make,
    model,
  }).catch(() => ({ carsMakeId: null, carsModelId: null }));
  const { regMonth, regYear } = parseReg(listing.year ?? null);
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
    const priceChanged = hasPriceChanged(price, existing.current_price);
    const vatChanged = vat != null ? vat !== existing.vat : false;
    const lastEditChanged = isDeep ? (listing.lastEdit || null) !== (existing.last_edit || null) : false;
    const hadViews = existing.views != null;
    const viewsChanged = isDeep ? hadViews && views !== existing.views : false;
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = booleanFlag(listing.kaparo) !== booleanFlag(existing.kaparo);
    const titleChanged = normalizedTitle !== (existing.title || '');
    const hadDescription = Boolean((existing.description || '').trim());
    const descriptionChanged = isDeep
      ? hadDescription && (listing.description || '') !== (existing.description || '')
      : false;
    const snapshotChanges = {
      price: { changed: priceChanged, previous: existing.current_price },
      vat: { changed: vatChanged, previous: existing.vat },
      lastEdit: { changed: lastEditChanged, previous: existing.last_edit || null },
      views: { changed: viewsChanged, previous: existing.views },
      adStatus: { changed: adStatusChanged, previous: existing.ad_status || 'none' },
      kaparo: { changed: kaparoChanged, previous: booleanFlag(existing.kaparo) },
      title: { changed: titleChanged, previous: existing.title || null },
      description: { changed: descriptionChanged, previous: existing.description || null },
    };
    const trackedChange = hasListingSnapshotChanges(snapshotChanges);

    let changeEvent: MobileBgChangeEvent | undefined;
    if (trackedChange) {
      insertListingSnapshot(db, existing.id, {
        ...buildListingSnapshotPayload(snapshotChanges),
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
    const imageSet: ColumnValues = imageData
      ? {
          image_count: listing.imageCount || 0,
          image_meta: JSON.stringify(imageData.meta),
          thumb_keys: JSON.stringify(imageData.thumbKeys),
          full_keys: JSON.stringify(imageData.fullKeys || []),
        }
      : {};
    const priceChangeDelta = getPriceChangeDelta({
      priceChanged,
      newPrice: price,
      oldPrice: existing.current_price,
      existingPriceChange: existing.price_change,
      missingOldPriceAsZero: true,
    });

    runUpdate(
      db,
      'listings',
      {
        dealer_id: dealerId,
        url: listing.url,
        title: normalizedTitle,
        make,
        model,
        mobile_make_id: mobileMakeId,
        mobile_model_id: mobileModelId,
        cars_make_id: carsMakeId,
        cars_model_id: carsModelId,
        reg_month: (isDeep || hasOverviewSpecs) && regMonth ? regMonth : existing.reg_month,
        reg_year: (isDeep || hasOverviewSpecs) && regYear ? regYear : existing.reg_year,
        fuel: (isDeep || hasOverviewSpecs) && fuel ? fuel : existing.fuel,
        body_type: (isDeep || hasOverviewSpecs) && bodyType ? bodyType : existing.body_type || bodyType || null,
        transmission: (isDeep || hasOverviewSpecs) && transmission ? transmission : existing.transmission,
        color: (isDeep || hasOverviewSpecs) && listing.color ? listing.color : existing.color,
        vin: isDeep ? vin : (existing.vin ?? null),
        euronorm: (isDeep || hasOverviewSpecs) && euronorm != null ? euronorm : (existing.euronorm ?? null),
        power: isDeep ? listing.power || null : existing.power,
        mileage: (isDeep || hasOverviewSpecs) && listing.mileage != null ? listing.mileage : existing.mileage,
        description: isDeep ? listing.description || null : existing.description,
        extras_json: isDeep ? extrasJson : (existing.extras_json ?? null),
        ad_status: listing.adStatus || existing.ad_status || 'none',
        kaparo: booleanFlag(listing.kaparo),
        is_new: isDeep ? booleanFlag(listing.isNew) : existing.is_new,
        last_edit: isDeep ? listing.lastEdit || null : existing.last_edit,
        views: isDeep ? views : (existing.views ?? null),
        current_price: price,
        vat: vat != null ? vat : (existing.vat ?? null),
        price_change: priceChangeDelta,
        ...imageSet,
        last_seen_at: now,
        thumb_saved: thumbSaved ? 1 : (existing.thumb_saved ?? 0),
      },
      { sql: 'id = ?', params: [existing.id] },
      ['is_active = 1', 'deleted_at = NULL'],
    );
    return { action: 'updated', snapshot: trackedChange, title: normalizedTitle, make, model, changeEvent };
  }

  runInsert(db, 'listings', {
    mobile_id: mobileId,
    dealer_id: dealerId,
    url: listing.url,
    title: normalizedTitle,
    make,
    model,
    mobile_make_id: mobileMakeId,
    mobile_model_id: mobileModelId,
    cars_make_id: carsMakeId,
    cars_model_id: carsModelId,
    reg_month: regMonth,
    reg_year: regYear,
    fuel: fuel || null,
    body_type: bodyType || null,
    transmission: transmission || null,
    color: listing.color || null,
    vin,
    euronorm,
    power: listing.power || null,
    mileage: listing.mileage || null,
    description: listing.description || null,
    extras_json: extrasJson,
    ad_status: listing.adStatus || 'none',
    kaparo: booleanFlag(listing.kaparo),
    is_new: booleanFlag(listing.isNew),
    last_edit: listing.lastEdit || null,
    views,
    current_price: price,
    vat,
    image_count: listing.imageCount || 0,
    image_meta: listing.images?.meta ? JSON.stringify(listing.images.meta) : null,
    thumb_keys: listing.images?.thumbKeys ? JSON.stringify(listing.images.thumbKeys) : null,
    full_keys: listing.images?.fullKeys ? JSON.stringify(listing.images.fullKeys) : null,
    images_downloaded: 0,
    thumb_saved: thumbSaved ? 1 : 0,
    first_seen_at: now,
    last_seen_at: now,
    is_active: 1,
    deleted_at: null,
  });
  return { action: 'inserted', snapshot: false, title: normalizedTitle, make, model };
}
