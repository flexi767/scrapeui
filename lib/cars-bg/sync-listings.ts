import type Database from 'better-sqlite3';
import { latestBackupOrderExpr, notDuplicateExpr } from '@/lib/query-modules/types';
import { parseCarsBgExtrasPayload } from '@/lib/cars-bg/sync-mapping';
import { parseCarsBgSyncListingImageSources } from '@/lib/cars-bg/sync-listing-images';
import type { CarsBgSyncListing } from '@/lib/cars-bg/sync-types';
import { getExtraLabels } from '@/lib/mobile-bg/extras';

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
    images: parseCarsBgSyncListingImageSources(db, row),
    carsBgExtras: parseCarsBgExtrasPayload(row.extras_json),
    extraLabels: getExtraLabels(row.extras_json),
  };
}

export function loadDealerMobileSyncListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
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

export function loadDealerCarsSyncListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
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
