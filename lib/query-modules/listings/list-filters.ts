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
  if (categories.length > 0) {
    wheres.push(`l.body_type IN (${categories.map(() => '?').join(',')})`);
    params.push(...categories);
  }
  if (statuses.length > 0) {
    wheres.push(`l.ad_status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter((value) => value !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      clauses.push(`l.vat IN (${nonNull.map(() => '?').join(',')})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push('l.vat IS NULL');
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    wheres.push(`l.fuel IN (${fuels.map(() => '?').join(',')})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    wheres.push(`(${extras.map(() => 'l.extras_json LIKE ?').join(' OR ')})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) { wheres.push('l.current_price >= ?'); params.push(priceMin); }
  if (priceMax !== null) { wheres.push('l.current_price <= ?'); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) { wheres.push('l.price_change >= ?'); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push('l.price_change <= ?'); params.push(priceChangeMax); }
  }
  if (kaparo) { wheres.push('l.kaparo = ?'); params.push(kaparo === 'yes' ? 1 : 0); }
  if (years.length > 0) {
    wheres.push(`l.reg_year IN (${years.map(() => '?').join(',')})`);
    params.push(...years);
  }
  if (search) {
    wheres.push('(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    wheres.push(`d.slug IN (${dealerSlugs.map(() => '?').join(',')})`);
    params.push(...dealerSlugs);
  }
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
  if (statuses.length > 0) {
    wheres.push(`COALESCE(b.ad_status, l.ad_status) IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes('null');
    const nonNull = vatValues.filter((value) => value !== 'null');
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      clauses.push(`${ownVatFilterExpr} IN (${nonNull.map(() => '?').join(',')})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push(`${ownVatFilterExpr} IS NULL`);
    if (clauses.length > 0) wheres.push(`(${clauses.join(' OR ')})`);
  }
  if (fuels.length > 0) {
    wheres.push(`COALESCE(b.fuel, l.fuel) IN (${fuels.map(() => '?').join(',')})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    wheres.push(`(${extras.map(() => 'COALESCE(b.extras_json, l.extras_json) LIKE ?').join(' OR ')})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) {
    wheres.push('COALESCE(b.price_amount, l.current_price) >= ?');
    params.push(priceMin);
  }
  if (priceMax !== null) {
    wheres.push('COALESCE(b.price_amount, l.current_price) <= ?');
    params.push(priceMax);
  }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push('l.price_change IS NOT NULL');
    if (priceChangeMin !== null) {
      wheres.push('l.price_change >= ?');
      params.push(priceChangeMin);
    }
    if (priceChangeMax !== null) {
      wheres.push('l.price_change <= ?');
      params.push(priceChangeMax);
    }
  }
  if (kaparo) {
    wheres.push('COALESCE(b.kaparo, l.kaparo) = ?');
    params.push(kaparo === 'yes' ? 1 : 0);
  }
  if (years.length > 0) {
    wheres.push(`l.reg_year IN (${years.map(() => '?').join(',')})`);
    params.push(...years);
  }
  if (search) {
    wheres.push(
      '(COALESCE(b.title, l.title) LIKE ? OR COALESCE(b.make, l.make) LIKE ? OR COALESCE(b.model, l.model) LIKE ?)',
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    wheres.push(`d.slug IN (${dealerSlugs.map(() => '?').join(',')})`);
    params.push(...dealerSlugs);
  }

  return { wheres, params };
}
