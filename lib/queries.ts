import { raw } from '@/db/client';

export interface ListingRow {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  mileage: number;
  current_price: number;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  is_new: number;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  dealer_name: string;
  dealer_slug: string;
  is_active: number;
}

export interface ListingFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  years?: string[];
  statuses?: string[];
  vatValues?: string[];
  kaparo?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const VALID_SORT: Record<string, string> = {
  price: 'l.current_price',
  last_edit: 'l.last_edit',
  mileage: 'l.mileage',
  dealer: 'd.name',
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
    statuses = [],
    vatValues = [],
    kaparo = '',
    sort = 'last_edit',
    order = 'desc',
    search = '',
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = ['l.is_active = 1'];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }

    wheres.push('l.kaparo = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
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

  const where = `WHERE ${wheres.join(' AND ')}`;
  const sortCol = VALID_SORT[sort] ?? 'l.last_edit';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

  const rows = raw.prepare(`
    SELECT
      l.id, l.mobile_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage,
      l.current_price, l.vat, l.kaparo, l.ad_status, l.last_edit, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.is_active,
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

export interface DetailListing {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  fuel: string;
  color: string;
  power: number;
  mileage: number;
  current_price: number;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  description: string;
  url: string;
  thumb_keys: string;
  full_keys: string;
  image_meta: string;
  images_downloaded: number;
  is_active: number;
  dealer_name: string;
  dealer_slug: string;
  dealer_own: number;
  dealer_url: string;
}

export function getListingByMobileId(mobileId: string): DetailListing | null {
  return raw.prepare(`
    SELECT
      l.*, d.name as dealer_name, d.slug as dealer_slug,
      d.own as dealer_own, d.mobile_url as dealer_url
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.mobile_id = ?
  `).get(mobileId) as DetailListing | null;
}

export interface SnapshotRow {
  id: number;
  price: number;
  vat: string | null;
  last_edit: string | null;
  ad_status: string | null;
  kaparo: number | null;
  title: string | null;
  description: string | null;
  recorded_at: string;
}

export function getSnapshots(listingId: number): SnapshotRow[] {
  return raw.prepare(`
    SELECT id, price, vat, last_edit, ad_status, kaparo, title, description, recorded_at
    FROM listing_snapshots
    WHERE listing_id = ?
    ORDER BY recorded_at ASC
  `).all(listingId) as SnapshotRow[];
}

export interface MakeModel {
  make: string;
  model: string;
}

export function getMakeModels(): Record<string, string[]> {
  const rows = raw.prepare(`
    SELECT DISTINCT make, model FROM listings WHERE is_active = 1 AND make IS NOT NULL ORDER BY make, model
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
  mobile_url?: string;
  mobile_user?: string | null;
  mobile_password?: string | null;
  cars_user?: string | null;
  cars_password?: string | null;
}

export function getAllDealers(): DealerRow[] {
  return raw.prepare('SELECT id, slug, name, own, active, mobile_url, mobile_user, mobile_password, cars_user, cars_password FROM dealers ORDER BY name').all() as DealerRow[];
}

export function getDistinctYears(): string[] {
  const rows = raw.prepare(
    `SELECT DISTINCT reg_year FROM listings WHERE is_active = 1 AND reg_year IS NOT NULL ORDER BY reg_year DESC`
  ).all() as { reg_year: string }[];
  return rows.map(r => r.reg_year);
}
