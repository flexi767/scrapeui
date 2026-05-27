import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { CARIMG_DIR } from '@/lib/storage-paths';
import { getCdnImageUrl, parseJson, type ImageMeta } from '@/lib/utils';
import { latestBackupOrderExpr, notDuplicateExpr } from '@/lib/query-modules/types';
import {
  type CarsBgExtrasPayload,
  normalizeLabel,
  normalizeCompareText,
  sanitizeCarsBgTitle,
  parseCarsBgExtrasPayload,
} from '@/lib/cars-bg/sync-mapping';
import { scoreCarsBgComparableMatch } from '@/lib/cars-bg/matching';
import { getExtraLabels } from '@/lib/mobile-bg/extras';

const LOCAL_IMAGE_BASE_DIR = CARIMG_DIR;

interface SyncListingRow {
  id: number;
  mobile_id: string | null;
  cars_id: string | null;
  dealer_id: number;
  url: string | null;
  title: string | null;
  carsbg_title: string | null;
  make: string | null;
  model: string | null;
  reg_month: string | null;
  reg_year: string | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  extras_json: string | null;
  ad_status: string | null;
  kaparo: number | null;
  current_price: number | null;
  vat: string | null;
  image_count: number | null;
  image_meta: string | null;
  full_keys: string | null;
  images_downloaded: number | null;
  latest_backup_id?: number | null;
}

export interface CarsBgSyncListing {
  id: number;
  mobileId: string | null;
  carsId: string | null;
  url: string;
  title: string;
  carsbgTitle: string | null;
  fullTitle: string;
  make: string | null;
  model: string | null;
  year: string | null;
  month: string | null;
  fuel: string | null;
  category: string | null;
  transmission: string | null;
  color: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  adStatus: string;
  kaparo: boolean;
  vat: string | null;
  price: { amount: number | null; currency: 'EUR' };
  images: string[];
  carsBgExtras: CarsBgExtrasPayload | null;
  extraLabels: string[];
}

export interface CarsBgDiff {
  mobileBg: CarsBgSyncListing;
  carsBg: CarsBgSyncListing;
  priceDiff: boolean;
  titleDiff: boolean;
  descriptionDiff: boolean;
}

export interface CarsBgSyncPlan {
  missing: CarsBgSyncListing[];
  diffs: CarsBgDiff[];
  staleCarsIds: string[];
}

export interface CarsBgSyncDealerIdentity {
  id: number;
  slug: string;
}

export function applyCarsBgSyncedContent(
  db: Database.Database,
  listingId: number,
  content: { title?: string | null; description?: string | null; price?: number | null },
): void {
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (content.price !== undefined) {
    assignments.push('current_price = ?');
    values.push(content.price ?? null);
  }
  if (content.title !== undefined) {
    assignments.push('carsbg_title = ?');
    values.push(content.title ?? null);
  }
  if (content.description !== undefined) {
    assignments.push('description = ?');
    values.push(content.description ?? null);
  }
  if (!assignments.length) return;
  values.push(listingId);
  db.prepare(`UPDATE listings SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
}

export function getStaleCarsBgListings(db: Database.Database, dealerSlug: string): string[] {
  const rows = db.prepare(`
    SELECT l.cars_id
    FROM listings l
    JOIN dealers d ON d.id = l.dealer_id
    WHERE d.slug = ?
      AND l.source = 'm'
      AND l.is_active = 0
      AND l.cars_id IS NOT NULL
  `).all(dealerSlug) as { cars_id: string }[];
  return rows.map((row) => row.cars_id).filter(Boolean);
}

function getBackupOrderedImages(db: Database.Database, backupId: number | null | undefined): string[] {
  if (!backupId) return [];
  const rows = db.prepare(`
    SELECT local_path, source_url
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backupId) as Array<{ local_path: string | null; source_url: string | null }>;

  return rows
    .map((row) => {
      if (row.local_path && fs.existsSync(row.local_path)) return row.local_path;
      return row.source_url;
    })
    .filter((value): value is string => Boolean(value));
}

function parseListingImageSources(db: Database.Database, row: SyncListingRow): string[] {
  const backupOrdered = getBackupOrderedImages(db, row.latest_backup_id);
  if (backupOrdered.length) return backupOrdered;

  const fullKeys = parseJson<string[]>(row.full_keys, []);
  if (!fullKeys.length || !row.mobile_id) return [];

  if (fullKeys[0]?.startsWith('http')) return fullKeys;

  if (row.images_downloaded === 1) {
    const local: string[] = [];
    for (let i = 0; i < fullKeys.length; i++) {
      const filename = `${String(i + 1).padStart(2, '0')}.webp`;
      const filePath = path.join(LOCAL_IMAGE_BASE_DIR, row.mobile_id, 'full', filename);
      if (fs.existsSync(filePath)) local.push(filePath);
    }
    if (local.length) return local;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  if (!imageMeta) return [];
  return fullKeys.map((key) => getCdnImageUrl(row.mobile_id!, key, imageMeta, 'full'));
}

function makeFullTitle(row: SyncListingRow): string {
  return [row.make, row.model, row.title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function mapRowToSyncListing(db: Database.Database, row: SyncListingRow): CarsBgSyncListing {
  const title = row.title || '';
  return {
    id: row.id,
    mobileId: row.mobile_id,
    carsId: row.cars_id,
    url: row.url || '',
    title,
    carsbgTitle: row.carsbg_title || null,
    fullTitle: makeFullTitle(row) || title,
    make: row.make,
    model: row.model,
    year: row.reg_year,
    month: row.reg_month,
    fuel: row.fuel,
    category: row.body_type,
    transmission: row.transmission,
    color: row.color,
    euronorm: row.euronorm,
    power: row.power,
    mileage: row.mileage,
    description: row.description,
    adStatus: row.ad_status || 'none',
    kaparo: row.kaparo === 1,
    vat: row.vat,
    price: { amount: row.current_price, currency: 'EUR' },
    images: parseListingImageSources(db, row),
    carsBgExtras: parseCarsBgExtrasPayload(row.extras_json),
    extraLabels: getExtraLabels(row.extras_json),
  };
}

function loadDealerMobileListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, euronorm, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded,
      (
        SELECT b.id
        FROM mobilebg_backups b
        WHERE b.listing_id = listings.id
        ORDER BY ${latestBackupOrderExpr}
        LIMIT 1
      ) as latest_backup_id
    FROM listings
    WHERE dealer_id = ?
      AND source = 'm'
      AND is_active = 1
      AND ${notDuplicateExpr}
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

function loadDealerCarsListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, euronorm, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded
    FROM listings
    WHERE dealer_id = ?
      AND source = 'c'
      AND is_active = 1
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

export function getCarsBgTitleValue(listing: CarsBgSyncListing): string {
  return sanitizeCarsBgTitle(listing.carsbgTitle || listing.title || listing.fullTitle || '');
}

function compareListings(mobile: CarsBgSyncListing[], cars: CarsBgSyncListing[]): CarsBgSyncPlan {
  const missing: CarsBgSyncListing[] = [];
  const diffs: CarsBgDiff[] = [];
  const matchedCars = new Set<number>();
  const carsById = new Map(cars.filter((entry) => entry.carsId).map((entry) => [entry.carsId!, entry]));

  for (const mobileListing of mobile) {
    let match: CarsBgSyncListing | null = null;

    if (mobileListing.carsId) {
      match = carsById.get(mobileListing.carsId) ?? null;
      if (match) {
        matchedCars.add(match.id);
      } else {
        continue;
      }
    }

    if (!match) {
      let best: { listing: CarsBgSyncListing; score: number } | null = null;

      for (const carsListing of cars) {
        if (matchedCars.has(carsListing.id)) continue;

        const score = scoreCarsBgComparableMatch(mobileListing, carsListing);
        if (score == null) continue;

        if (!best || score > best.score) best = { listing: carsListing, score };
      }

      if (best && best.score >= 4) {
        match = best.listing;
        matchedCars.add(match.id);
      }
    }

    if (!match) {
      missing.push(mobileListing);
      continue;
    }

    const priceDiff = mobileListing.price.amount != null
      && match.price.amount != null
      && Number(mobileListing.price.amount) !== Number(match.price.amount);
    const targetTitle = getCarsBgTitleValue(mobileListing);
    const currentCarsTitle = getCarsBgTitleValue(match);
    const titleDiff = Boolean(
      targetTitle &&
      normalizeLabel(targetTitle) !== normalizeLabel(currentCarsTitle),
    );
    const targetDescription = normalizeCompareText(mobileListing.description);
    const currentDescription = normalizeCompareText(match.description);
    const descriptionDiff = Boolean(
      targetDescription &&
      currentDescription &&
      targetDescription !== currentDescription,
    );

    if (priceDiff || titleDiff || descriptionDiff) {
      diffs.push({ mobileBg: mobileListing, carsBg: match, priceDiff, titleDiff, descriptionDiff });
    }
  }

  return {
    missing,
    diffs,
    staleCarsIds: [],
  };
}

export async function planCarsBgDealerSync(
  db: Database.Database,
  dealer: CarsBgSyncDealerIdentity,
): Promise<CarsBgSyncPlan> {
  const mobileListings = loadDealerMobileListings(db, dealer.id);
  const carsListings = loadDealerCarsListings(db, dealer.id);
  const plan = compareListings(mobileListings, carsListings);
  plan.staleCarsIds = getStaleCarsBgListings(db, dealer.slug);
  return plan;
}
