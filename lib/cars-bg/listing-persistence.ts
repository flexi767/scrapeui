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
import { insertListingSnapshot } from '@/lib/listings/snapshots';
import { normalizeBodyTypeSync, getBodyTypeMap } from '@/lib/mobile-bg/body-types';
import { normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';

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
  if (mobileViewsChanged) insertListingSnapshot(db, matchingMobile.id, { views: oldMobileViews, recordedAt: now });

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
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } = parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || rawTitle).trim();
  const fuel = normalizeFuelSync(normCarsBgFuel(listing.fuel ?? null), fuelMap);
  const bodyType = normalizeBodyTypeSync(normCarsBgBody(listing.bodyType ?? null), getBodyTypeMap());
  const transmission = normalizeTransmissionSync(normCarsBgTrans(listing.transmission ?? null), transmissionMap);
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
    db.prepare(`
      UPDATE listings
      SET
        carsbg_title = ?,
        carsbg_created_date = ?,
        carsbg_edited_date = ?,
        cars_price = ?
      WHERE id = ?
    `).run(carsbgTitle, carsbgCreatedDate, carsbgEditedDate, mobileCarsPrice, matchingMobile.id);
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

    let changeEvent: Record<string, unknown> | undefined;
    if (trackedChange && hasSnapshotPayload) {
      insertListingSnapshot(db, existing.id, {
        price: snapshotPrice,
        adStatus: snapshotAdStatus,
        kaparo: snapshotKaparo,
        title: snapshotTitle,
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
        oldPrice: priceChanged ? existing.current_price : null,
        newPrice: priceChanged ? price : null,
        adStatusChanged,
        oldStatus: adStatusChanged ? existing.ad_status : null,
        newStatus: adStatusChanged ? (listing.adStatus || 'none') : null,
        kaparoChanged,
        titleChanged,
      };
    }

    const priceChangeDelta = priceChanged && existing.current_price != null
      ? price - existing.current_price
      : existing.price_change ?? null;
    const listingImages = listing.images ?? [];
    const hasImages = listingImages.length > 0;
    const imageFields = hasImages ? 'image_count = ?, full_keys = ?,' : '';
    const imageValues = hasImages ? [listingImages.length, JSON.stringify(listingImages)] : [];
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
      now, isDuplicate, existing.id,
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
    now, now, isDuplicate,
  );
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

