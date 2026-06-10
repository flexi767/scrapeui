import type { ListingFilters } from '../types';
import {
  ownAdStatusExpr,
  ownEffectiveVatExpr,
  ownExtrasJsonExpr,
  ownFuelExpr,
  ownKaparoExpr,
  ownMakeExpr,
  ownMileageExpr,
  ownModelExpr,
  ownPriceExpr,
  ownViewsExpr,
} from '../types';

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
  price: ownPriceExpr,
  last_edit: 'l.last_edit',
  carsbg_created_date: 'l.carsbg_created_date',
  views: ownViewsExpr,
  mileage: ownMileageExpr,
  fuel: ownFuelExpr,
  dealer: 'd.priority DESC, d.name',
  ad_status: ownAdStatusExpr,
  kaparo: ownKaparoExpr,
  reg_year: 'l.reg_year',
};

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

export function toListingFtsQuery(value: string): string {
  const terms = value
    .normalize('NFKC')
    .match(/[\p{L}\p{N}]+/gu)
    ?.map((term) => term.toLowerCase())
    .filter((term) => term.length > 0)
    .slice(0, 8) ?? [];

  return terms.map((term) => `${term}*`).join(' ');
}

export function buildListingFilters(
  filters: ListingFilters,
  initialWheres: string[],
  options: { includeSearch?: boolean } = {},
): { wheres: string[]; params: (string | number)[] } {
  const { includeSearch = true } = options;
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
  if (includeSearch && search) {
    const ftsQuery = toListingFtsQuery(search);
    if (ftsQuery) {
      wheres.push(`EXISTS (
        SELECT 1
        FROM listings_search_fts
        WHERE listings_search_fts.rowid = l.id
          AND listings_search_fts MATCH ?
      )`);
      params.push(ftsQuery);
    }
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
    wheres.push(`${ownMakeExpr} = ?`);
    params.push(make);
  }
  if (model) {
    wheres.push(`${ownModelExpr} = ?`);
    params.push(model);
  }
  addInFilter(wheres, params, ownAdStatusExpr, statuses);
  addNullableInFilter(wheres, params, ownEffectiveVatExpr, vatValues);
  addInFilter(wheres, params, ownFuelExpr, fuels);
  addLikeAnyFilter(wheres, params, ownExtrasJsonExpr, extras);
  addMinMaxFilter(wheres, params, ownPriceExpr, priceMin, priceMax);
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
    const ftsQuery = toListingFtsQuery(search);
    if (ftsQuery) {
      wheres.push(`EXISTS (
        SELECT 1
        FROM listings_search_fts
        WHERE listings_search_fts.rowid = l.id
          AND listings_search_fts MATCH ?
      )`);
      params.push(ftsQuery);
    }
  }
  addInFilter(wheres, params, 'd.slug', dealerSlugs);

  return { wheres, params };
}
