import { raw } from '@/db/client';

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
  runs: number;
  backups: number;
  images: number;
  editForms: number;
  repostJobs: number;
}

export interface MobileBgBackupRunRow {
  id: number;
  status: string;
  source_url: string | null;
  listings_count: number;
  images_count: number;
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

const ownVatExpr = `
  CASE
    WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
    WHEN b.vat_included IN (1, '1') THEN 'included'
    WHEN b.vat_included IN (0, '0') THEN 'exempt'
    ELSE l.vat
  END
`;

const ownNeedsSyncExpr = `
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

const VALID_SORT: Record<string, string> = {
  price: 'l.current_price',
  last_edit: 'l.last_edit',
  carsbg_created_date: 'l.carsbg_created_date',
  views: 'l.views',
  mileage: 'l.mileage',
  fuel: 'l.fuel',
  dealer: 'd.priority DESC, d.name',
  ad_status: 'l.ad_status',
  kaparo: 'l.kaparo',
  reg_year: 'l.reg_year',
};

export function getListings(filters: ListingFilters = {}) {
  const {
    make = '',
    model = '',
    dealerSlugs = [],
    years = [],
    categories = [],
    statuses = [],
    vatValues = [],
    fuels = [],
    extras = [],
    priceMin = null,
    priceMax = null,
    priceChangeMin = null,
    priceChangeMax = null,
    kaparo = '',
    source = '',
    sort = 'price',
    order = 'desc',
    search = '',
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = ['l.is_active = 1', 'd.active = 1', '(l.duplicate = 0 OR l.duplicate IS NULL)'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }
  if (categories.length > 0) {
    const ph = categories.map(() => '?').join(',');
    wheres.push(`l.body_type IN (${ph})`);
    params.push(...categories);
  }

  if (statuses.length > 0) {
    const ph = statuses.map(() => '?').join(',');
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter(v => v !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => '?').join(',');
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push('l.vat IS NULL');
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => '?').join(',');
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(() => 'l.extras_json LIKE ?');
    wheres.push(`(${clauses.join(' OR ')})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) { wheres.push('l.current_price >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('l.current_price <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) {
    wheres.push('l.kaparo = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => '?').join(',');
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => '?').join(',');
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }
  if (source) { wheres.push('l.source = ?'); params.push(source); }

  const where = `WHERE ${wheres.join(' AND ')}`;
  const sortCol = VALID_SORT[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active,
      COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ListingRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getDeletedListings(filters: ListingFilters = {}) {
  const {
    make = '',
    model = '',
    dealerSlugs = [],
    years = [],
    categories = [],
    statuses = [],
    vatValues = [],
    fuels = [],
    extras = [],
    priceMin = null,
    priceMax = null,
    priceChangeMin = null,
    priceChangeMax = null,
    kaparo = '',
    source = '',
    sort = 'last_edit',
    order = 'desc',
    search = '',
    page = 1,
    limit = 50,
  } = filters;

  const wheres: string[] = ['l.is_active = 0', 'l.deleted_at IS NOT NULL', 'd.active = 1', '(l.duplicate = 0 OR l.duplicate IS NULL)'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }
  if (categories.length > 0) {
    const ph = categories.map(() => '?').join(',');
    wheres.push(`l.body_type IN (${ph})`);
    params.push(...categories);
  }
  if (statuses.length > 0) {
    const ph = statuses.map(() => '?').join(',');
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter(v => v !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => '?').join(',');
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push('l.vat IS NULL');
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => '?').join(',');
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(() => 'l.extras_json LIKE ?');
    wheres.push(`(${clauses.join(' OR ')})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) { wheres.push('l.current_price >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('l.current_price <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) {
    wheres.push('l.kaparo = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => '?').join(',');
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => '?').join(',');
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }
  if (source) { wheres.push('l.source = ?'); params.push(source); }

  const where = `WHERE ${wheres.join(' AND ')}`;
  const sortCol = VALID_SORT[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active, l.deleted_at,
      COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ListingRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getOwnListings(filters: ListingFilters = {}) {
  const {
    make = '',
    model = '',
    dealerSlugs = [],
    years = [],
    statuses = [],
    vatValues = [],
    fuels = [],
    extras = [],
    priceMin = null,
    priceMax = null,
    priceChangeMin = null,
    priceChangeMax = null,
    kaparo = '',
    sort = 'last_edit',
    order = 'desc',
    search = '',
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = ['l.is_active = 1', 'd.active = 1', 'd.own = 1', '(l.duplicate = 0 OR l.duplicate IS NULL)'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('COALESCE(b.make, l.make) = ?'); params.push(make); }
  if (model) { wheres.push('COALESCE(b.model, l.model) = ?'); params.push(model); }

  if (statuses.length > 0) {
    const ph = statuses.map(() => '?').join(',');
    wheres.push(`COALESCE(b.ad_status, l.ad_status) IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter(v => v !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => '?').join(',');
      clauses.push(`(CASE
        WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
        WHEN b.vat_included IN (1, '1') THEN 'included'
        WHEN b.vat_included IN (0, '0') THEN 'exempt'
        ELSE l.vat
      END) IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push(`(CASE
      WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
      WHEN b.vat_included IN (1, '1') THEN 'included'
      WHEN b.vat_included IN (0, '0') THEN 'exempt'
      ELSE l.vat
    END) IS NULL`);
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => '?').join(',');
    wheres.push(`COALESCE(b.fuel, l.fuel) IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(() => 'COALESCE(b.extras_json, l.extras_json) LIKE ?');
    wheres.push(`(${clauses.join(' OR ')})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) { wheres.push('COALESCE(b.price_amount, l.current_price) >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('COALESCE(b.price_amount, l.current_price) <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) {
    wheres.push('COALESCE(b.kaparo, l.kaparo) = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => '?').join(',');
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(COALESCE(b.title, l.title) LIKE ? OR COALESCE(b.make, l.make) LIKE ? OR COALESCE(b.model, l.model) LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => '?').join(',');
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }

  const ownSortCol = ({
    price: 'COALESCE(b.price_amount, l.current_price)',
    last_edit: 'l.last_edit',
    carsbg_created_date: 'l.carsbg_created_date',
    views: 'COALESCE(b.views, l.views)',
    mileage: 'COALESCE(b.mileage, l.mileage)',
    fuel: 'COALESCE(b.fuel, l.fuel)',
    dealer: 'd.priority DESC, d.name',
    ad_status: 'COALESCE(b.ad_status, l.ad_status)',
    kaparo: 'COALESCE(b.kaparo, l.kaparo)',
    reg_year: 'l.reg_year',
  } as Record<string, string>)[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
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
      ${ownNeedsSyncExpr} as needs_sync,
      CASE WHEN EXISTS (
        SELECT 1
        FROM listing_search_profiles sp
        WHERE sp.listing_id = l.id
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
    WHERE b.row_num = 1 AND ${wheres.join(' AND ')}
    ORDER BY ${ownSortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as OwnListingRow[];

  const { count } = raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT COUNT(*) as count
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1 AND ${wheres.join(' AND ')}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getOwnListingByMobileId(mobileId: string): OwnListingRow | null {
  return raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
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
      ${ownNeedsSyncExpr} as needs_sync,
      CASE WHEN EXISTS (
        SELECT 1
        FROM listing_search_profiles sp
        WHERE sp.listing_id = l.id
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
  `).get(mobileId) as OwnListingRow | null;
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
  const byMobile = raw.prepare(`
    SELECT
      l.*, COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, d.mobile_url as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ?
  `).get(mobileId) as DetailListing | null;
  if (byMobile) return byMobile;
  // Fallback: try cars_id for cars.bg-sourced listings
  return raw.prepare(`
    SELECT
      l.*, COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, COALESCE(d.cars_url, d.mobile_url) as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.cars_id = ?
  `).get(mobileId) as DetailListing | null;
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
  return raw.prepare(`
    SELECT id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at
    FROM listing_snapshots
    WHERE listing_id = ?
    ORDER BY recorded_at ASC
  `).all(listingId) as SnapshotRow[];
}

export interface TrackedChangeRow {
  id: number;
  listing_id: number;
  mobile_id: string | null;
  cars_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  source: string | null;
  image_meta: string | null;
  thumb_keys: string | null;
  full_keys: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  snapshot_price: number | null;
  snapshot_vat: string | null;
  snapshot_last_edit: string | null;
  snapshot_views: number | null;
  snapshot_ad_status: string | null;
  snapshot_kaparo: number | null;
  snapshot_title: string | null;
  snapshot_description: string | null;
  recorded_at: string;
  target_price: number | null;
  target_vat: string | null;
  target_last_edit: string | null;
  target_views: number | null;
  target_ad_status: string | null;
  target_kaparo: number | null;
  target_title: string | null;
  target_description: string | null;
  current_price: number | null;
  current_vat: string | null;
  current_last_edit: string | null;
  current_views: number | null;
  current_ad_status: string | null;
  current_kaparo: number | null;
  current_title: string | null;
  current_description: string | null;
}

export interface TrackedChangesFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  fields?: string[];
  search?: string;
  whenStart?: string | null;
  whenEnd?: string | null;
  page?: number;
  limit?: number;
}

export interface TrackedChangeWindow {
  value: string;
  start: string;
  end: string;
  count: number;
}

function buildTrackedChangesWhere(filters: TrackedChangesFilters): { where: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.make) {
    clauses.push('l.make = ?');
    params.push(filters.make);
  }
  if (filters.model) {
    clauses.push('l.model = ?');
    params.push(filters.model);
  }
  if (filters.dealerSlugs && filters.dealerSlugs.length > 0) {
    clauses.push(`d.slug IN (${filters.dealerSlugs.map(() => '?').join(', ')})`);
    params.push(...filters.dealerSlugs);
  }
  if (filters.search) {
    clauses.push(`(
      l.title LIKE ?
      OR l.make LIKE ?
      OR l.model LIKE ?
      OR l.description LIKE ?
      OR d.name LIKE ?
      OR l.mobile_id LIKE ?
      OR l.cars_id LIKE ?
    )`);
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like, like, like);
  }
  if (filters.whenStart && filters.whenEnd) {
    clauses.push('s.recorded_at >= ? AND s.recorded_at <= ?');
    params.push(filters.whenStart, filters.whenEnd);
  }
  if (filters.fields && filters.fields.length > 0) {
    const fieldMap: Record<string, string> = {
      price: 's.price IS NOT NULL',
      vat: 's.vat IS NOT NULL',
      last_edit: 's.last_edit IS NOT NULL',
      views: 's.views IS NOT NULL',
      ad_status: 's.ad_status IS NOT NULL',
      kaparo: 's.kaparo IS NOT NULL',
      title: `s.title IS NOT NULL AND TRIM(s.title) != ''`,
      description: `s.description IS NOT NULL AND TRIM(s.description) != ''`,
    };
    const selectedClauses = filters.fields
      .map((field) => fieldMap[field])
      .filter(Boolean);
    if (selectedClauses.length > 0) clauses.push(`(${selectedClauses.join(' OR ')})`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function getTrackedChangeWindows(): TrackedChangeWindow[] {
  const rows = raw.prepare(`
    SELECT recorded_at
    FROM listing_snapshots
    ORDER BY recorded_at DESC, id DESC
  `).all() as { recorded_at: string }[];

  const windows: TrackedChangeWindow[] = [];
  const windowMs = 10 * 60 * 1000;
  let current: { latestMs: number; latest: string; earliestMs: number; earliest: string; count: number } | null = null;

  for (const row of rows) {
    const time = new Date(row.recorded_at).getTime();
    if (Number.isNaN(time)) continue;
    if (!current || current.latestMs - time > windowMs) {
      if (current) {
        windows.push({
          value: current.latest,
          start: current.earliest,
          end: current.latest,
          count: current.count,
        });
      }
      current = {
        latestMs: time,
        latest: row.recorded_at,
        earliestMs: time,
        earliest: row.recorded_at,
        count: 1,
      };
      continue;
    }

    current.earliestMs = time;
    current.earliest = row.recorded_at;
    current.count += 1;
  }

  if (current) {
    windows.push({
      value: current.latest,
      start: current.earliest,
      end: current.latest,
      count: current.count,
    });
  }

  return windows;
}

export function getTrackedChanges(filters: TrackedChangesFilters = {}): { data: TrackedChangeRow[]; total: number } {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;
  const { where, params } = buildTrackedChangesWhere(filters);
  const actualChangeWhere = `
    (
      (snapshot_price IS NOT NULL AND snapshot_price != target_price) OR
      (snapshot_vat IS NOT NULL AND snapshot_vat != target_vat) OR
      (snapshot_last_edit IS NOT NULL AND snapshot_last_edit != target_last_edit) OR
      (snapshot_views IS NOT NULL AND snapshot_views != target_views) OR
      (snapshot_ad_status IS NOT NULL AND snapshot_ad_status != target_ad_status) OR
      (snapshot_kaparo IS NOT NULL AND snapshot_kaparo != target_kaparo) OR
      (snapshot_title IS NOT NULL AND TRIM(snapshot_title) != '' AND snapshot_title != target_title) OR
      (snapshot_description IS NOT NULL AND TRIM(snapshot_description) != '' AND snapshot_description != target_description)
    )
  `;

  const baseFrom = `
    FROM listing_snapshots s
    JOIN listings l ON l.id = s.listing_id
    LEFT JOIN dealers d ON d.id = l.dealer_id
    ${where}
  `;

  const totalRow = raw.prepare(`
    WITH change_rows AS (
      SELECT
        s.price as snapshot_price,
        s.vat as snapshot_vat,
        s.last_edit as snapshot_last_edit,
        s.views as snapshot_views,
        s.ad_status as snapshot_ad_status,
        s.kaparo as snapshot_kaparo,
        s.title as snapshot_title,
        s.description as snapshot_description,
        COALESCE((
          SELECT s2.price
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.price IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.current_price) as target_price,
        COALESCE((
          SELECT s2.vat
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.vat IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.vat) as target_vat,
        COALESCE((
          SELECT s2.last_edit
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.last_edit IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.last_edit) as target_last_edit,
        COALESCE((
          SELECT s2.views
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.views IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END) as target_views,
        COALESCE((
          SELECT s2.ad_status
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.ad_status IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.ad_status) as target_ad_status,
        COALESCE((
          SELECT s2.kaparo
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.kaparo IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.kaparo) as target_kaparo,
        COALESCE((
          SELECT s2.title
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.title IS NOT NULL
            AND TRIM(s2.title) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.title) as target_title,
        COALESCE((
          SELECT s2.description
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.description IS NOT NULL
            AND TRIM(s2.description) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.description) as target_description
      ${baseFrom}
    )
    SELECT COUNT(*) as count
    FROM change_rows
    WHERE ${actualChangeWhere}
  `).get(...params) as { count: number };

  const data = raw.prepare(`
    WITH change_rows AS (
      SELECT
        s.id,
        s.listing_id,
        l.mobile_id,
        l.cars_id,
        l.title,
        l.make,
        l.model,
        d.name as dealer_name,
        d.slug as dealer_slug,
        l.source,
        l.image_meta,
        l.thumb_keys,
        l.full_keys,
        l.images_downloaded,
        l.thumb_saved,
        s.price as snapshot_price,
        s.vat as snapshot_vat,
        s.last_edit as snapshot_last_edit,
        s.views as snapshot_views,
        s.ad_status as snapshot_ad_status,
        s.kaparo as snapshot_kaparo,
        s.title as snapshot_title,
        s.description as snapshot_description,
        s.recorded_at,
        COALESCE((
          SELECT s2.price
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.price IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.current_price) as target_price,
        COALESCE((
          SELECT s2.vat
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.vat IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.vat) as target_vat,
        COALESCE((
          SELECT s2.last_edit
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.last_edit IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.last_edit) as target_last_edit,
        COALESCE((
          SELECT s2.views
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.views IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END) as target_views,
        COALESCE((
          SELECT s2.ad_status
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.ad_status IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.ad_status) as target_ad_status,
        COALESCE((
          SELECT s2.kaparo
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.kaparo IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.kaparo) as target_kaparo,
        COALESCE((
          SELECT s2.title
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.title IS NOT NULL
            AND TRIM(s2.title) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.title) as target_title,
        COALESCE((
          SELECT s2.description
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.description IS NOT NULL
            AND TRIM(s2.description) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.description) as target_description,
        l.current_price,
        l.vat as current_vat,
        l.last_edit as current_last_edit,
        CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END as current_views,
        l.ad_status as current_ad_status,
        l.kaparo as current_kaparo,
        l.title as current_title,
        l.description as current_description
      ${baseFrom}
    )
    SELECT *
    FROM change_rows
    WHERE ${actualChangeWhere}
    ORDER BY recorded_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as TrackedChangeRow[];

  return { data, total: totalRow.count };
}

export interface MakeModel {
  make: string;
  model: string;
}

export function getMakeModels(): Record<string, string[]> {
  const rows = raw.prepare(`
    SELECT DISTINCT make, model FROM listings WHERE is_active = 1 AND make IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL) ORDER BY make, model
  `).all() as MakeModel[];
  const result: Record<string, string[]> = {};
  for (const r of rows) {
    if (!result[r.make]) result[r.make] = [];
    result[r.make].push(r.model);
  }
  return result;
}

export interface DealerRow {
  id: number;
  slug: string;
  name: string;
  own: number;
  active: number;
  priority: number;
  mobile_url?: string;
}

export interface DealerRowFull extends DealerRow {
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  // Credentials are excluded here — use getDealerById for the config UI where they're needed
  return raw.prepare('SELECT id, slug, name, own, active, priority, mobile_url FROM dealers ORDER BY priority DESC, name').all() as DealerRow[];
}

export function getDistinctYears(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT reg_year FROM listings WHERE is_active = 1 AND reg_year IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL) ORDER BY reg_year DESC`
  ).all() as { reg_year: string }[];
  return rows.map(r => r.reg_year);
}

export function getPriceRange(): { min: number; max: number } | null {
  const row = raw.prepare(
    `SELECT MIN(current_price) as min, MAX(current_price) as max FROM listings WHERE is_active = 1 AND current_price IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL)`
  ).get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
}

export function getPriceChangeRange(): { min: number; max: number } | null {
  const row = raw.prepare(
    `SELECT MIN(price_change) as min, MAX(price_change) as max FROM listings WHERE price_change IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL)`
  ).get() as { min: number | null; max: number | null };
  if (row.min == null || row.max == null) return null;
  return { min: row.min, max: row.max };
}

export function getDistinctFuels(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT fuel FROM listings WHERE is_active = 1 AND fuel IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL) ORDER BY fuel`
  ).all() as { fuel: string }[];
  return rows.map(r => r.fuel);
}

export function getDistinctCategories(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT body_type FROM listings WHERE is_active = 1 AND body_type IS NOT NULL AND (duplicate = 0 OR duplicate IS NULL) ORDER BY body_type`
  ).all() as { body_type: string }[];
  return rows.map(r => r.body_type);
}

// ─── Users ────────────────────────────────────────────────────────

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
}

export function getAllUsers(): UserRow[] {
  return raw.prepare('SELECT id, username, name, role FROM users ORDER BY name').all() as UserRow[];
}

// ─── Labels ───────────────────────────────────────────────────────

export interface LabelRow {
  id: number;
  name: string;
  color: string;
}

export function getAllLabels(): LabelRow[] {
  return raw.prepare('SELECT id, name, color FROM labels ORDER BY name').all() as LabelRow[];
}

// ─── Listing Summaries (for pickers) ─────────────────────────────

export interface ListingSummary {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_year: string;
  current_price: number;
  vat: string | null;
}

export function getListingSummaries(): ListingSummary[] {
  return raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price, l.vat
    FROM listings l
    JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1 AND d.own = 1 AND (l.duplicate = 0 OR l.duplicate IS NULL)
    ORDER BY l.make, l.model, l.reg_year
  `).all() as ListingSummary[];
}

// ─── Tasks ────────────────────────────────────────────────────────

export interface TaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  created_by_id: number | null;
  parent_id: number | null;
  deadline: string | null;
  is_recurring: number;
  recur_rule: string | null;
  created_at: string;
  updated_at: string;
  assignee_name: string | null;
  creator_name: string | null;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assigneeId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export function getTasks(filters: TaskFilters = {}) {
  const { status, priority, assigneeId, search, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (status) { wheres.push('t.status = ?'); params.push(status); }
  if (priority) { wheres.push('t.priority = ?'); params.push(priority); }
  if (assigneeId) { wheres.push('t.assignee_id = ?'); params.push(assigneeId); }
  if (search) {
    wheres.push('(t.title LIKE ?)');
    params.push(`%${search}%`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT t.*,
      a.name as assignee_name,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by_id
    ${where}
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'backlog' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END,
      CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as TaskRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM tasks t ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getTaskById(id: number) {
  const task = raw.prepare(`
    SELECT t.*,
      a.name as assignee_name,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users a ON a.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by_id
    WHERE t.id = ?
  `).get(id) as TaskRow | undefined;

  if (!task) return null;

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM task_listings tl
    JOIN listings l ON l.id = tl.listing_id
    WHERE tl.task_id = ?
  `).all(id) as ListingSummary[];

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM task_labels tl
    JOIN labels lb ON lb.id = tl.label_id
    WHERE tl.task_id = ?
  `).all(id) as LabelRow[];

  const subtasks = raw.prepare(`
    SELECT t.id, t.title, t.status, t.priority
    FROM tasks t WHERE t.parent_id = ?
    ORDER BY t.created_at
  `).all(id) as { id: number; title: string; status: string; priority: string }[];

  const deps = raw.prepare(`
    SELECT t.id, t.title, t.status
    FROM task_deps td
    JOIN tasks t ON t.id = td.depends_on_id
    WHERE td.task_id = ?
  `).all(id) as { id: number; title: string; status: string }[];

  return { ...task, listings, labels, subtasks, deps };
}

export function getTaskLabels(taskId: number): LabelRow[] {
  return raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM task_labels tl
    JOIN labels lb ON lb.id = tl.label_id
    WHERE tl.task_id = ?
  `).all(taskId) as LabelRow[];
}

export function getTaskListings(taskId: number): ListingSummary[] {
  return raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM task_listings tl
    JOIN listings l ON l.id = tl.listing_id
    WHERE tl.task_id = ?
  `).all(taskId) as ListingSummary[];
}

// ─── Comments ─────────────────────────────────────────────────────

export interface CommentRow {
  id: number;
  task_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string;
}

export function getTaskComments(taskId: number): CommentRow[] {
  return raw.prepare(`
    SELECT c.*, u.name as author_name
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ?
    ORDER BY c.created_at ASC
  `).all(taskId) as CommentRow[];
}

// ─── Time Entries ─────────────────────────────────────────────────

export interface TimeEntryRow {
  id: number;
  task_id: number;
  user_id: number;
  description: string | null;
  duration_minutes: number;
  date: string;
  created_at: string;
  user_name: string;
}

export function getTaskTimeEntries(taskId: number): TimeEntryRow[] {
  return raw.prepare(`
    SELECT te.*, u.name as user_name
    FROM time_entries te
    JOIN users u ON u.id = te.user_id
    WHERE te.task_id = ?
    ORDER BY te.date DESC, te.created_at DESC
  `).all(taskId) as TimeEntryRow[];
}

// ─── Activity Log ─────────────────────────────────────────────────

export interface ActivityRow {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  detail: string | null;
  user_id: number | null;
  created_at: string;
  user_name: string | null;
}

export function getActivityLog(entityType: string, entityId: number): ActivityRow[] {
  return raw.prepare(`
    SELECT al.*, u.name as user_name
    FROM activity_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.entity_type = ? AND al.entity_id = ?
    ORDER BY al.created_at DESC
    LIMIT 100
  `).all(entityType, entityId) as ActivityRow[];
}

// ─── Expenses ─────────────────────────────────────────────────────

export interface ExpenseRow {
  id: number;
  title: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
  creator_name: string | null;
}

export interface ExpenseFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function getExpenses(filters: ExpenseFilters = {}) {
  const { category, dateFrom, dateTo, search, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (category) { wheres.push('e.category = ?'); params.push(category); }
  if (dateFrom) { wheres.push('e.date >= ?'); params.push(dateFrom); }
  if (dateTo) { wheres.push('e.date <= ?'); params.push(dateTo); }
  if (search) { wheres.push('e.title LIKE ?'); params.push(`%${search}%`); }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ExpenseRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM expenses e ${where}
  `).get(...params) as { count: number };

  const { total_amount } = raw.prepare(`
    SELECT COALESCE(SUM(e.amount), 0) as total_amount FROM expenses e ${where}
  `).get(...params) as { total_amount: number };

  return { data: rows, total: count, totalAmount: total_amount, page, limit };
}

export function getExpenseById(id: number) {
  const expense = raw.prepare(`
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.created_by_id
    WHERE e.id = ?
  `).get(id) as ExpenseRow | undefined;

  if (!expense) return null;

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM expense_listings el
    JOIN listings l ON l.id = el.listing_id
    WHERE el.expense_id = ?
  `).all(id) as ListingSummary[];

  const tasks = raw.prepare(`
    SELECT t.id, t.title, t.status
    FROM expense_tasks et
    JOIN tasks t ON t.id = et.task_id
    WHERE et.expense_id = ?
  `).all(id) as { id: number; title: string; status: string }[];

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM expense_labels el
    JOIN labels lb ON lb.id = el.label_id
    WHERE el.expense_id = ?
  `).all(id) as LabelRow[];

  const uploads = raw.prepare(`
    SELECT * FROM uploads
    WHERE entity_type = 'expense' AND entity_id = ?
    ORDER BY created_at DESC
  `).all(id);

  return { ...expense, listings, tasks, labels, uploads };
}

// ─── Articles (Knowledge Base) ────────────────────────────────────

export interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  body: string;
  author_id: number;
  created_at: string;
  updated_at: string;
  author_name: string;
}

export interface ArticleFilters {
  search?: string;
  labelId?: number;
  page?: number;
  limit?: number;
}

export function getArticles(filters: ArticleFilters = {}) {
  const { search, labelId, page = 1, limit = 50 } = filters;
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (search) { wheres.push('a.title LIKE ?'); params.push(`%${search}%`); }
  if (labelId) {
    wheres.push('EXISTS (SELECT 1 FROM article_labels al WHERE al.article_id = a.id AND al.label_id = ?)');
    params.push(labelId);
  }

  const where = wheres.length ? `WHERE ${wheres.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ArticleRow[];

  const { count } = raw.prepare(`
    SELECT COUNT(*) as count FROM articles a ${where}
  `).get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getArticleBySlug(slug: string) {
  const article = raw.prepare(`
    SELECT a.*, u.name as author_name
    FROM articles a
    LEFT JOIN users u ON u.id = a.author_id
    WHERE a.slug = ?
  `).get(slug) as ArticleRow | undefined;

  if (!article) return null;

  const labels = raw.prepare(`
    SELECT lb.id, lb.name, lb.color
    FROM article_labels al
    JOIN labels lb ON lb.id = al.label_id
    WHERE al.article_id = ?
  `).all(article.id) as LabelRow[];

  const listings = raw.prepare(`
    SELECT l.id, l.mobile_id, l.title, l.make, l.model, l.reg_year, l.current_price
    FROM article_listings al
    JOIN listings l ON l.id = al.listing_id
    WHERE al.article_id = ?
  `).all(article.id) as ListingSummary[];

  const uploads = raw.prepare(`
    SELECT * FROM uploads
    WHERE entity_type = 'article' AND entity_id = ?
    ORDER BY created_at DESC
  `).all(article.id);

  return { ...article, labels, listings, uploads };
}

// ─── Tasks by Listing ─────────────────────────────────────────────

export function getTasksByListing(listingId: number) {
  return raw.prepare(`
    SELECT t.id, t.title, t.status, t.priority, t.deadline, t.created_at,
      a.name as assignee_name
    FROM task_listings tl
    JOIN tasks t ON t.id = tl.task_id
    LEFT JOIN users a ON a.id = t.assignee_id
    WHERE tl.listing_id = ?
    ORDER BY
      CASE t.status WHEN 'in_progress' THEN 0 WHEN 'backlog' THEN 1 WHEN 'done' THEN 2 WHEN 'cancelled' THEN 3 END,
      t.created_at DESC
  `).all(listingId);
}

// ─── Expenses by Listing ──────────────────────────────────────────

export function getExpensesByListing(listingId: number) {
  return raw.prepare(`
    SELECT e.id, e.title, e.amount, e.currency, e.date, e.category
    FROM expense_listings el
    JOIN expenses e ON e.id = el.expense_id
    WHERE el.listing_id = ?
    ORDER BY e.date DESC
  `).all(listingId);
}

export function getMakeModelMappings(limit = 500): MakeModelMappingRow[] {
  return raw.prepare(`
    SELECT
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id,
      COUNT(*) as listing_count,
      MIN(l.mobile_id) as sample_mobile_id,
      MIN(l.title) as sample_title,
      GROUP_CONCAT(DISTINCT d.name) as dealer_names,
      MAX(l.last_edit) as latest_last_edit
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1
    GROUP BY
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id
    ORDER BY
      CASE
        WHEN l.mobile_make_id IS NULL OR l.mobile_model_id IS NULL OR l.cars_make_id IS NULL OR l.cars_model_id IS NULL THEN 0
        ELSE 1
      END,
      COUNT(*) DESC,
      l.make,
      l.model
    LIMIT ?
  `).all(limit) as MakeModelMappingRow[];
}

export function getMobileBgDashboardSummary(): MobileBgDashboardSummary {
  const runs = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_backup_runs`).get() as { count: number };
  const backups = raw.prepare(`
    SELECT COUNT(*) as count
    FROM (
      SELECT 1
      FROM mobilebg_backups
      GROUP BY dealer_id, mobile_id
    )
  `).get() as { count: number };
  const images = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_backup_images`).get() as { count: number };
  const editForms = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_edit_form_snapshots`).get() as { count: number };
  const repostJobs = raw.prepare(`SELECT COUNT(*) as count FROM mobilebg_repost_jobs`).get() as { count: number };
  return {
    runs: runs.count,
    backups: backups.count,
    images: images.count,
    editForms: editForms.count,
    repostJobs: repostJobs.count,
  };
}

export function getMobileBgBackupRuns(limit = 20): MobileBgBackupRunRow[] {
  return raw.prepare(`
    SELECT
      r.id, r.status, r.source_url, r.listings_count, r.images_count, r.notes,
      r.started_at, r.finished_at, r.created_at, r.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_backup_runs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `).all(limit) as MobileBgBackupRunRow[];
}

export function getMobileBgBackups(limit = 100): MobileBgBackupListRow[] {
  return raw.prepare(`
    WITH ranked AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT
      b.id, b.run_id, b.listing_id, b.mobile_id, b.source_url, b.source_title,
      b.make, b.model, b.title, b.price_amount, b.price_currency, b.image_count,
      b.created_at, b.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM ranked b
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1
    ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
    LIMIT ?
  `).all(limit) as MobileBgBackupListRow[];
}

export function getMobileBgBackupById(id: number): (MobileBgBackupDetailRow & { images: MobileBgBackupImageRow[] }) | null {
  const row = raw.prepare(`
    SELECT
      b.id, b.run_id, b.listing_id, b.mobile_id, b.source_url, b.source_title,
      b.make, b.model, b.title, b.price_amount, b.price_currency, b.vat_included,
      b.year, b.mileage, b.fuel, b.power, b.engine, b.color, b.transmission,
      b.category as body_type, b.description, b.phones_json, b.extras_json, b.tech_data_json, b.photo_order_json,
      b.ad_status, b.kaparo, COALESCE(b.draft_needs_sync, 0) as draft_needs_sync,
      b.last_mobile_sync_status, b.last_mobile_sync_error, b.last_mobile_sync_at,
      b.image_count, b.created_at, b.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_backups b
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.id = ?
  `).get(id) as MobileBgBackupDetailRow | undefined;

  if (!row) return null;

  const images = raw.prepare(`
    SELECT id, backup_id, sort_order, filename, source_url, local_path, created_at
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id) as MobileBgBackupImageRow[];

  return { ...row, images };
}

export function getEditOwnSyncRows(): EditOwnSyncRow[] {
  return raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      d.name as dealer_name,
      d.slug as dealer_slug,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.price_amount, l.current_price) as current_price,
      ${ownVatExpr} as vat,
      COALESCE(b.ad_status, l.ad_status) as ad_status,
      COALESCE(b.kaparo, l.kaparo) as kaparo,
      l.title as source_title,
      l.current_price as source_price,
      l.vat as source_vat,
      l.ad_status as source_ad_status,
      l.kaparo as source_kaparo,
      ${ownNeedsSyncExpr} as needs_sync,
      CASE
        WHEN ${ownNeedsSyncExpr} = 0 AND b.last_mobile_sync_status = 'pending' THEN NULL
        ELSE b.last_mobile_sync_status
      END as last_mobile_sync_status,
      b.last_mobile_sync_error,
      b.last_mobile_sync_at
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE b.row_num = 1 AND d.own = 1 AND d.active = 1
    ORDER BY
      CASE WHEN ${ownNeedsSyncExpr} = 1 THEN 0 ELSE 1 END,
      COALESCE(b.updated_at, b.created_at) DESC,
      b.id DESC
  `).all() as EditOwnSyncRow[];
}

export function getMobileBgEditForms(limit = 100): MobileBgEditFormRow[] {
  return raw.prepare(`
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ?
  `).all(limit) as MobileBgEditFormRow[];
}

export function getMobileBgEditFormById(id: number): MobileBgEditFormDetailRow | null {
  const row = raw.prepare(`
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      e.forms_json, e.fields_json, e.checked_boxes_json, e.checked_radios_json, e.hidden_json,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    WHERE e.id = ?
  `).get(id) as MobileBgEditFormDetailRow | undefined;
  return row ?? null;
}

export function getMobileBgRepostJobs(limit = 100): MobileBgRepostJobRow[] {
  return raw.prepare(`
    SELECT
      r.id, r.backup_id, r.listing_id, r.source_mobile_id, r.target_mobile_id, r.status,
      r.message, r.preview_screenshot_path, r.debug_dir, r.started_at, r.finished_at, r.created_at,
      d.name as dealer_name, d.slug as dealer_slug,
      b.title as backup_title
    FROM mobilebg_repost_jobs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    LEFT JOIN mobilebg_backups b ON r.backup_id = b.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `).all(limit) as MobileBgRepostJobRow[];
}
