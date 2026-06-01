import type Database from 'better-sqlite3';
import { currentIsoTimestamp } from '@/lib/date-format';
import { findMatchingMobileListing } from '@/lib/cars-bg/matching';
import {
  extractCarsId,
  extractThumbFromListing,
  normCarsBgBody,
  normCarsBgFuel,
  normCarsBgTrans,
} from '@/lib/cars-bg/parse';
import {
  getPriceChangeDelta,
  hasListingSnapshotPayload,
  insertListingSnapshot,
  previousValueIfChanged,
} from '@/lib/listings/snapshots';
import { normalizeListingSpecs } from '@/lib/listings/normalize';
import { runInsert, runUpdate } from '@/lib/listings/sql';
import { type MakesMap } from '@/lib/mobile-bg/makes-models';

export interface CarsBgOwnerDetails {
  carsTotalViews: number | null;
  carsImages: string[];
  description: string | null;
}

export interface CarsBgScrapedListing {
  url: string;
  title: string;
  adStatus: string;
  kaparo: boolean;
  thumb?: string | null;
  carsbgEditedDate?: string | null;
  carsbgCreatedDate?: string | null;
  price?: { amount: number | null; currency: string };
  year?: string | null;
  mileage?: number | null;
  power?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  color?: string | null;
  description?: string | null;
  images?: string[] | null;
  dealer?: string | null;
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
  carsbg_title: string | null;
  carsbg_created_date: string | null;
  carsbg_edited_date: string | null;
  cars_total_views?: number | null;
  image_count: number | null;
  full_keys: string | null;
  last_edit: string | null;
}

export interface CarsBgOwnerUpdateResult {
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
}

export interface CarsBgUpsertResult {
  action: 'skip' | 'updated' | 'inserted';
  snapshot: boolean;
  title: string;
  make: string | null;
  model: string | null;
  duplicate: boolean;
  trackedChange: boolean;
  syncNeeded: boolean;
  mobilePrice: number | null;
  changeEvent?: Record<string, unknown>;
}

export function applyCarsBgOwnerDetails(
  db: Database.Database,
  dealerId: number,
  carsId: string,
  details: CarsBgOwnerDetails,
): CarsBgOwnerUpdateResult {
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

  const now = currentIsoTimestamp();
  const oldViews = existingCars.cars_total_views ?? null;
  const newViews = details.carsTotalViews ?? null;
  const viewsChanged = oldViews != null && newViews != null && oldViews !== newViews;
  const imageCount = details.carsImages.length > 0 ? details.carsImages.length : (existingCars.image_count ?? 0);
  const fullKeys = details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : existingCars.full_keys ?? null;

  if (viewsChanged) insertListingSnapshot(db, existingCars.id, { views: oldViews, recordedAt: now });

  const descriptionProvided = typeof details.description === 'string';

  runUpdate(
    db,
    'listings',
    {
      cars_total_views: details.carsTotalViews,
      cars_images: details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : null,
      image_count: imageCount,
      full_keys: fullKeys,
      description: descriptionProvided ? details.description!.trim() || null : undefined,
      last_seen_at: now,
    },
    { sql: 'id = ?', params: [existingCars.id] },
    ['is_active = 1'],
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
  if (mobileViewsChanged) insertListingSnapshot(db, matchingMobile.id, { views: oldMobileViews, recordedAt: now });

  runUpdate(
    db,
    'listings',
    {
      cars_total_views: details.carsTotalViews,
      cars_images: details.carsImages.length > 0 ? JSON.stringify(details.carsImages) : null,
    },
    { sql: 'id = ?', params: [matchingMobile.id] },
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

export function upsertCarsBgListing(
  db: Database.Database,
  dealerId: number,
  listing: CarsBgScrapedListing,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
): CarsBgUpsertResult {
  const now = currentIsoTimestamp();
  const carsId = extractCarsId(listing.url);
  if (!carsId) {
    return {
      action: 'skip',
      snapshot: false,
      title: listing.title || '',
      make: '',
      model: '',
      duplicate: false,
      trackedChange: false,
      syncNeeded: false,
      mobilePrice: null,
    };
  }

  const rawTitle = listing.title || '';
  const { make, model, mobileMakeId, mobileModelId, normalizedTitle, fuel, bodyType, transmission } =
    normalizeListingSpecs(
      rawTitle,
      {
        fuel: normCarsBgFuel(listing.fuel ?? null),
        bodyType: normCarsBgBody(listing.bodyType ?? null),
        transmission: normCarsBgTrans(listing.transmission ?? null),
      },
      { makesMap, fuelMap, transmissionMap },
    );
  const price: number | null = listing.price?.amount ?? null;
  const carsbgTitle: string | null = normalizedTitle || null;
  const carsbgCreatedDate: string | null = listing.carsbgCreatedDate ?? null;
  const carsbgEditedDate: string | null = listing.carsbgEditedDate ?? null;
  const rawDescription: string | null | undefined = listing.description;
  const descriptionProvided = typeof rawDescription === 'string';
  const descriptionValue: string | null = descriptionProvided ? (rawDescription!.trim() || null) : null;
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
    runUpdate(
      db,
      'listings',
      {
        carsbg_title: carsbgTitle,
        carsbg_created_date: carsbgCreatedDate,
        carsbg_edited_date: carsbgEditedDate,
        cars_price: mobileCarsPrice,
      },
      { sql: 'id = ?', params: [matchingMobile.id] },
    );
  }

  const existing = db.prepare('SELECT * FROM listings WHERE cars_id = ? AND source = ?').get(carsId, 'c') as ExistingCarsListing | undefined;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const titleChanged = normalizedTitle !== (existing.title || '');
    const adStatusChanged = (listing.adStatus || 'none') !== (existing.ad_status || 'none');
    const kaparoChanged = (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const trackedChange = priceChanged || titleChanged || adStatusChanged || kaparoChanged;
    const snapshot = {
      price: previousValueIfChanged(priceChanged, existing.current_price),
      adStatus: previousValueIfChanged(adStatusChanged, existing.ad_status || 'none'),
      kaparo: previousValueIfChanged(kaparoChanged, existing.kaparo ? 1 : 0),
      title: previousValueIfChanged(titleChanged, existing.title || null),
    };

    let changeEvent: Record<string, unknown> | undefined;
    if (trackedChange && hasListingSnapshotPayload(snapshot)) {
      insertListingSnapshot(db, existing.id, {
        ...snapshot,
        recordedAt: now,
      });
      changeEvent = {
        type: 'change',
        carsId,
        make,
        model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null,
        thumb: listing.thumb || null,
        price,
        mobilePrice: matchingMobile?.current_price ?? null,
        priceChanged,
        oldPrice: previousValueIfChanged(priceChanged, existing.current_price),
        newPrice: priceChanged ? price : null,
        adStatusChanged,
        oldStatus: previousValueIfChanged(adStatusChanged, existing.ad_status),
        newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged,
        titleChanged,
      };
    }

    const priceChangeDelta = getPriceChangeDelta({
      priceChanged,
      newPrice: price,
      oldPrice: existing.current_price,
      existingPriceChange: existing.price_change,
    });
    const listingImages = listing.images ?? [];
    const hasImages = listingImages.length > 0;

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
        fuel: fuel || existing.fuel,
        body_type: bodyType || existing.body_type,
        transmission: transmission || existing.transmission,
        color: listing.color || existing.color,
        power: listing.power || existing.power,
        mileage: listing.mileage || existing.mileage,
        ad_status: listing.adStatus || existing.ad_status || 'none',
        kaparo: listing.kaparo ? 1 : 0,
        current_price: price,
        price_change: priceChangeDelta,
        reg_year: listing.year || existing.reg_year,
        last_edit: carsbgEditedDate || existing.last_edit || existing.carsbg_edited_date || null,
        carsbg_title: carsbgTitle || existing.carsbg_title || null,
        carsbg_created_date: carsbgCreatedDate || existing.carsbg_created_date || null,
        carsbg_edited_date: carsbgEditedDate || existing.carsbg_edited_date || null,
        cars_price: null,
        description: descriptionProvided ? descriptionValue : undefined,
        image_count: hasImages ? listingImages.length : undefined,
        full_keys: hasImages ? JSON.stringify(listingImages) : undefined,
        last_seen_at: now,
        duplicate: isDuplicate,
      },
      { sql: 'id = ?', params: [existing.id] },
      ['is_active = 1'],
    );
    return {
      action: 'updated',
      snapshot: priceChanged,
      title: normalizedTitle,
      make,
      model,
      duplicate: isDuplicate === 1,
      trackedChange,
      syncNeeded,
      mobilePrice: matchingMobile?.current_price ?? null,
      changeEvent,
    };
  }

  runInsert(db, 'listings', {
    cars_id: carsId,
    dealer_id: dealerId,
    url: listing.url,
    title: normalizedTitle,
    make,
    model,
    mobile_make_id: mobileMakeId,
    mobile_model_id: mobileModelId,
    fuel: fuel || null,
    body_type: bodyType || null,
    transmission: transmission || null,
    color: listing.color || null,
    power: listing.power || null,
    mileage: listing.mileage || null,
    ad_status: listing.adStatus || 'none',
    kaparo: listing.kaparo ? 1 : 0,
    current_price: price,
    reg_year: listing.year || null,
    last_edit: carsbgEditedDate,
    carsbg_title: carsbgTitle,
    carsbg_created_date: carsbgCreatedDate,
    carsbg_edited_date: carsbgEditedDate,
    cars_price: null,
    description: descriptionValue,
    image_count: listing.images?.length || 0,
    full_keys: listing.images ? JSON.stringify(listing.images) : null,
    first_seen_at: now,
    last_seen_at: now,
    is_active: 1,
    source: 'c',
    duplicate: isDuplicate,
  });
  return {
    action: 'inserted',
    snapshot: false,
    title: normalizedTitle,
    make,
    model,
    duplicate: isDuplicate === 1,
    trackedChange: false,
    syncNeeded,
    mobilePrice: matchingMobile?.current_price ?? null,
  };
}
