export interface ListingRow {
  id: number;
  mobile_id: string;
  cars_id: string | null;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  mileage: number;
  fuel: string | null;
  body_type: string | null;
  vin?: string | null;
  euronorm?: number | null;
  current_price: number;
  cars_price?: number | null;
  price_change: number | null;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  carsbg_title?: string | null;
  carsbg_created_date: string | null;
  carsbg_edited_date?: string | null;
  views: number | null;
  cars_total_views?: number | null;
  is_new: number;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  thumb_saved?: number;
  first_backup_image_id?: number | null;
  dealer_name: string;
  dealer_slug: string;
  is_active: number;
  deleted_at?: string | null;
  source: string;
}

export interface OwnListingRow extends ListingRow {
  watching: number | null;
  needs_sync: number;
  backup_id: number;
  first_backup_image_id?: number | null;
  has_saved_search_profile: number;
  last_mobile_sync_status: string | null;
  last_mobile_sync_error: string | null;
  last_mobile_sync_at: string | null;
  search_checked_at: string | null;
  search_original_position: number | null;
  search_price_position: number | null;
  search_first_result_price: number | null;
}

export interface MakeModelMappingRow {
  make: string | null;
  model: string | null;
  mobile_make_id: number | null;
  mobile_model_id: number | null;
  cars_make_id: number | null;
  cars_model_id: number | null;
  listing_count: number;
  sample_mobile_id: string | null;
  sample_title: string | null;
  dealer_names: string | null;
  latest_last_edit: string | null;
}

export interface MobileBgDashboardSummary {
  crawlRuns: number;
  backups: number;
  editForms: number;
  repostJobs: number;
}

export interface MobileBgCrawlRunRow {
  id: number;
  status: string;
  source_url: string | null;
  listings_count: number;
  images_count: number;
  images_downloaded: number;
  images_failed: number;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

export interface MobileBgBackupListRow {
  id: number;
  run_id: number | null;
  listing_id: number | null;
  mobile_id: string | null;
  source_url: string | null;
  source_title: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  price_amount: number | null;
  price_currency: string | null;
  image_count: number;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  first_backup_image_id: number | null;
}

export interface MobileBgBackupImageRow {
  id: number;
  backup_id: number;
  sort_order: number;
  filename: string;
  source_url: string | null;
  local_path: string;
  created_at: string | null;
}

export interface MobileBgBackupDetailRow extends MobileBgBackupListRow {
  vat_included: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  body_type: string | null;
  description: string | null;
  ad_status: string | null;
  kaparo: number | null;
  draft_needs_sync: number;
  last_mobile_sync_status: string | null;
  last_mobile_sync_error: string | null;
  last_mobile_sync_at: string | null;
  phones_json: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
  photo_order_json: string | null;
}

export interface MobileBgEditFormRow {
  id: number;
  backup_id: number | null;
  listing_id: number | null;
  mobile_id: string | null;
  source_url: string | null;
  listing_token: string | null;
  row_title: string | null;
  row_price_text: string | null;
  form_url: string | null;
  screenshot_path: string | null;
  created_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
}

export interface MobileBgEditFormDetailRow extends MobileBgEditFormRow {
  forms_json: string | null;
  fields_json: string | null;
  checked_boxes_json: string | null;
  checked_radios_json: string | null;
  hidden_json: string | null;
}

export interface MobileBgRepostJobRow {
  id: number;
  backup_id: number | null;
  listing_id: number | null;
  source_mobile_id: string | null;
  target_mobile_id: string | null;
  status: string;
  message: string | null;
  preview_screenshot_path: string | null;
  debug_dir: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  backup_title: string | null;
}

export interface EditOwnSyncRow {
  backup_id: number;
  listing_id: number;
  mobile_id: string;
  dealer_name: string | null;
  dealer_slug: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  current_price: number | null;
  vat: string | null;
  ad_status: string | null;
  kaparo: number | null;
  source_title: string | null;
  source_price: number | null;
  source_vat: string | null;
  source_ad_status: string | null;
  source_kaparo: number | null;
  needs_sync: number;
  last_mobile_sync_status: string | null;
  last_mobile_sync_error: string | null;
  last_mobile_sync_at: string | null;
}

export interface ListingFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  years?: string[];
  categories?: string[];
  statuses?: string[];
  vatValues?: string[];
  fuels?: string[];
  extras?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  priceChangeMin?: number | null;
  priceChangeMax?: number | null;
  kaparo?: string;
  source?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const ownVatExpr = `
  CASE
    WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
    WHEN b.vat_included IN (1, '1') THEN 'included'
    WHEN b.vat_included IN (0, '0') THEN 'exempt'
    ELSE l.vat
  END
`;

export const ownNeedsSyncExpr = `
  CASE
    WHEN COALESCE(b.draft_needs_sync, 0) = 1 AND (
      IFNULL(COALESCE(b.title, l.title), '') != IFNULL(l.title, '') OR
      IFNULL(COALESCE(b.price_amount, l.current_price), -1) != IFNULL(l.current_price, -1) OR
      IFNULL(${ownVatExpr}, '') != IFNULL(l.vat, '') OR
      IFNULL(COALESCE(b.ad_status, l.ad_status), 'none') != IFNULL(l.ad_status, 'none') OR
      IFNULL(COALESCE(b.kaparo, l.kaparo), 0) != IFNULL(l.kaparo, 0)
    ) THEN 1
    ELSE 0
  END
`;

/**
 * Subquery: first backup image id for a listing (via backup join).
 * Use when `l` is the listings alias and `b`/`i` aliases are not yet in scope.
 */
export const firstBackupImageIdExpr = `(
  SELECT i.id
  FROM mobilebg_backups b
  JOIN mobilebg_backup_images i ON i.backup_id = b.id
  WHERE b.listing_id = l.id
  ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC, i.sort_order ASC, i.id ASC
  LIMIT 1
)`;

/**
 * Subquery: first backup image id when backup `b` is already joined.
 * Use when `b` is in scope (own-listing queries with LEFT JOIN mobilebg_backups b).
 */
export const firstBackupImageIdFromBackupExpr = `(
  SELECT i.id
  FROM mobilebg_backup_images i
  WHERE i.backup_id = b.id
  ORDER BY i.sort_order ASC, i.id ASC
  LIMIT 1
)`;
