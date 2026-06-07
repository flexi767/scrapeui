import type { ListingFilters } from '../types';

export const LISTING_SORT_COLUMNS: Record<string, string> = {
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

export const OWN_LISTING_SORT_COLUMNS: Record<string, string> = {
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
};

const ownVatFilterExpr = `(CASE
  WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
  WHEN b.vat_included IN (1, '1') THEN 'included'
  WHEN b.vat_included IN (0, '0') THEN 'exempt'
  ELSE l.vat
END)`;

type FilterParams = (string | number)[];

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(',');
}

function addInFilter(
  wheres: string[],
  params: FilterParams,
  expression: string,
  values: string[],
) {
  if (values.length === 0) return;
  wheres.push(`${expression} IN (${placeholders(values)})`);
  params.push(...values);
}

function addNullableInFilter(
  wheres: string[],
  params: FilterParams,
  expression: string,
  values: string[],
) {
  if (values.length === 0) return;

  const includeNull = values.includes('null');
  const nonNull = values.filter((value) => value !== 'null');
  const clauses: string[] = [];

  if (nonNull.length > 0) {
    clauses.push(`${expression} IN (${placeholders(nonNull)})`);
    params.push(...nonNull);
  }
  if (includeNull) clauses.push(`${expression} IS NULL`);
  if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
}

function addLikeAnyFilter(
  wheres: string[],
  params: FilterParams,
  expression: string,
  values: string[],
) {
  if (values.length === 0) return;
  wheres.push(`(${values.map(() => `${expression} LIKE ?`).join(' OR ')})`);
  params.push(...values.map((value) => `%${value}%`));
}

function addMinMaxFilter(
  wheres: string[],
  params: FilterParams,
  expression: string,
  min: number | null,
  max: number | null,
) {
  if (min !== null) {
    wheres.push(`${expression} >= ?`);
    params.push(min);
  }
  if (max !== null) {
    wheres.push(`${expression} <= ?`);
    params.push(max);
  }
}

export function buildListingFilters(
  filters: ListingFilters,
  initialWheres: string[],
): { wheres: string[]; params: (string | number)[] } {
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
    search = '',
  } = filters;

  const wheres = [...initialWheres];
  const params: (string | number)[] = [];

  if (make) { wheres.push('l.make = ?'); params.push(make); }
  if (model) { wheres.push('l.model = ?'); params.push(model); }
  addInFilter(wheres, params, 'l.body_type', categories);
  addInFilter(wheres, params, 'l.ad_status', statuses);
  addNullableInFilter(wheres, params, 'l.vat', vatValues);
  addInFilter(wheres, params, 'l.fuel', fuels);
  addLikeAnyFilter(wheres, params, 'l.extras_json', extras);
  addMinMaxFilter(wheres, params, 'l.current_price', priceMin, priceMax);
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    addMinMaxFilter(wheres, params, 'l.price_change', priceChangeMin, priceChangeMax);
  }
  if (kaparo) { wheres.push('l.kaparo = ?'); params.push(kaparo === 'yes' ? 1 : 0); }
  addInFilter(wheres, params, 'l.reg_year', years);
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  addInFilter(wheres, params, 'd.slug', dealerSlugs);
  if (source) { wheres.push('l.source = ?'); params.push(source); }

  return { wheres, params };
}

export function buildOwnListingFilters(
  filters: ListingFilters,
  initialWheres: string[],
): { wheres: string[]; params: (string | number)[] } {
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
    search = '',
  } = filters;

  const wheres = [...initialWheres];
  const params: (string | number)[] = [];

  if (make) {
    wheres.push('COALESCE(b.make, l.make) = ?');
    params.push(make);
  }
  if (model) {
    wheres.push('COALESCE(b.model, l.model) = ?');
    params.push(model);
  }
  addInFilter(wheres, params, 'COALESCE(b.ad_status, l.ad_status)', statuses);
  addNullableInFilter(wheres, params, ownVatFilterExpr, vatValues);
  addInFilter(wheres, params, 'COALESCE(b.fuel, l.fuel)', fuels);
  addLikeAnyFilter(wheres, params, 'COALESCE(b.extras_json, l.extras_json)', extras);
  addMinMaxFilter(wheres, params, 'COALESCE(b.price_amount, l.current_price)', priceMin, priceMax);
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    addMinMaxFilter(wheres, params, 'l.price_change', priceChangeMin, priceChangeMax);
  }
  if (kaparo) {
    wheres.push('COALESCE(b.kaparo, l.kaparo) = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  addInFilter(wheres, params, 'l.reg_year', years);
  if (search) {
    wheres.push(
      '(COALESCE(b.title, l.title) LIKE ? OR COALESCE(b.make, l.make) LIKE ? OR COALESCE(b.model, l.model) LIKE ?)',
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  addInFilter(wheres, params, 'd.slug', dealerSlugs);

  return { wheres, params };
}
