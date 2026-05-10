import { raw } from '@/db/client';
import type { OwnListingRow } from '../types';
import { firstBackupImageIdFromBackupExpr, latestBackupOrderExpr, ownNeedsSyncExpr, ownVatExpr, rankedBackupsCte } from '../types';

export function getOwnListingByMobileId(
  mobileId: string,
): OwnListingRow | null {
  return raw
    .prepare(
      `
    ${rankedBackupsCte}
    SELECT
      b.id as backup_id,
      l.id, l.mobile_id,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      l.reg_month, l.reg_year,
      COALESCE(b.mileage, l.mileage) as mileage,
      COALESCE(b.category, l.body_type) as body_type,
      COALESCE(b.fuel, l.fuel) as fuel,
      COALESCE(b.price_amount, l.current_price) as current_price,
      l.price_change,
      ${ownVatExpr} as vat,
      COALESCE(b.kaparo, l.kaparo) as kaparo,
      COALESCE(b.ad_status, l.ad_status) as ad_status,
      l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, COALESCE(b.views, l.views) as views, l.cars_total_views, b.watching as watching, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active,
      ${firstBackupImageIdFromBackupExpr} as first_backup_image_id,
      ${ownNeedsSyncExpr} as needs_sync,
      CASE WHEN EXISTS (
        SELECT 1
        FROM saved_searches ss
        WHERE ss.listing_id = l.id
      ) THEN 1 ELSE 0 END as has_saved_search_profile,
      CASE
        WHEN ${ownNeedsSyncExpr} = 0 AND b.last_mobile_sync_status = 'pending' THEN NULL
        ELSE b.last_mobile_sync_status
      END as last_mobile_sync_status,
      b.last_mobile_sync_error,
      b.last_mobile_sync_at,
      b.search_checked_at,
      b.search_original_position,
      b.search_price_position,
      b.search_first_result_price,
      d.name as dealer_name, d.slug as dealer_slug
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1 AND l.mobile_id = ? AND d.own = 1
  `,
    )
    .get(mobileId) as OwnListingRow | null;
}

export interface DetailListing {
  id: number;
  mobile_id: string;
  cars_id: string | null;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  fuel: string;
  color: string;
  vin: string | null;
  euronorm: number | null;
  power: number;
  mileage: number;
  current_price: number;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  carsbg_title: string | null;
  carsbg_created_date: string | null;
  carsbg_edited_date: string | null;
  views: number | null;
  description: string;
  url: string;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  is_active: number;
  source: string;
  dealer_name: string;
  dealer_slug: string;
  dealer_own: number;
  dealer_url: string;
}

export function getListingByMobileId(mobileId: string): DetailListing | null {
  const byMobile = raw
    .prepare(
      `
    SELECT
      l.*, COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, d.mobile_url as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ?
  `,
    )
    .get(mobileId) as DetailListing | null;
  if (byMobile) return byMobile;
  // Fallback: try cars_id for cars.bg-sourced listings
  return raw
    .prepare(
      `
    SELECT
      l.*, COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, COALESCE(d.cars_url, d.mobile_url) as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.cars_id = ?
  `,
    )
    .get(mobileId) as DetailListing | null;
}

export interface SnapshotRow {
  id: number;
  price: number | null;
  vat: string | null;
  last_edit: string | null;
  views: number | null;
  ad_status: string | null;
  kaparo: number | null;
  title: string | null;
  description: string | null;
  recorded_at: string;
}

export function getSnapshots(listingId: number): SnapshotRow[] {
  return raw
    .prepare(
      `
    SELECT id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at
    FROM listing_snapshots
    WHERE listing_id = ?
    ORDER BY recorded_at ASC
  `,
    )
    .all(listingId) as SnapshotRow[];
}
