import { raw } from '@/db/client';
import type { ListingFilters, ListingRow, OwnListingRow } from '../types';
import { firstBackupImageIdExpr, firstBackupImageIdFromBackupExpr, latestBackupOrderExpr, notDuplicateLExpr, ownNeedsSyncExpr, ownVatExpr, rankedBackupsCte } from '../types';

const VALID_SORT: Record<string, string> = {
  price: "l.current_price",
  last_edit: "l.last_edit",
  carsbg_created_date: "l.carsbg_created_date",
  views: "l.views",
  mileage: "l.mileage",
  fuel: "l.fuel",
  dealer: "d.priority DESC, d.name",
  ad_status: "l.ad_status",
  kaparo: "l.kaparo",
  reg_year: "l.reg_year",
};

function buildListingFilters(
  filters: ListingFilters,
  initialWheres: string[],
): { wheres: string[]; params: (string | number)[] } {
  const {
    make = "",
    model = "",
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
    kaparo = "",
    source = "",
    search = "",
  } = filters;

  const wheres = [...initialWheres];
  const params: (string | number)[] = [];

  if (make) { wheres.push("l.make = ?"); params.push(make); }
  if (model) { wheres.push("l.model = ?"); params.push(model); }
  if (categories.length > 0) {
    wheres.push(`l.body_type IN (${categories.map(() => "?").join(",")})`);
    params.push(...categories);
  }
  if (statuses.length > 0) {
    wheres.push(`l.ad_status IN (${statuses.map(() => "?").join(",")})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes("null");
    const nonNull = vatValues.filter((v) => v !== "null");
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      clauses.push(`l.vat IN (${nonNull.map(() => "?").join(",")})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push("l.vat IS NULL");
    if (clauses.length > 0) wheres.push(`(${clauses.join(" OR ")})`);
  }
  if (fuels.length > 0) {
    wheres.push(`l.fuel IN (${fuels.map(() => "?").join(",")})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    wheres.push(`(${extras.map(() => "l.extras_json LIKE ?").join(" OR ")})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) { wheres.push("l.current_price >= ?"); params.push(priceMin); }
  if (priceMax !== null) { wheres.push("l.current_price <= ?"); params.push(priceMax); }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push("l.price_change IS NOT NULL");
    if (priceChangeMin !== null) { wheres.push("l.price_change >= ?"); params.push(priceChangeMin); }
    if (priceChangeMax !== null) { wheres.push("l.price_change <= ?"); params.push(priceChangeMax); }
  }
  if (kaparo) { wheres.push("l.kaparo = ?"); params.push(kaparo === "yes" ? 1 : 0); }
  if (years.length > 0) {
    wheres.push(`l.reg_year IN (${years.map(() => "?").join(",")})`);
    params.push(...years);
  }
  if (search) {
    wheres.push("(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    wheres.push(`d.slug IN (${dealerSlugs.map(() => "?").join(",")})`);
    params.push(...dealerSlugs);
  }
  if (source) { wheres.push("l.source = ?"); params.push(source); }

  return { wheres, params };
}

export function getListings(filters: ListingFilters = {}) {
  const { sort = "price", order = "desc", page = 1, limit = 25 } = filters;

  const { wheres, params } = buildListingFilters(filters, [
    "l.is_active = 1",
    "d.active = 1",
    notDuplicateLExpr,
  ]);

  const where = `WHERE ${wheres.join(" AND ")}`;
  const sortCol = VALID_SORT[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active,
      ${firstBackupImageIdExpr} as first_backup_image_id,
      COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as ListingRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getDeletedListings(filters: ListingFilters = {}) {
  const { sort = "last_edit", order = "desc", page = 1, limit = 50 } = filters;

  const { wheres, params } = buildListingFilters(filters, [
    "l.is_active = 0",
    "l.deleted_at IS NOT NULL",
    "d.active = 1",
    notDuplicateLExpr,
  ]);

  const where = `WHERE ${wheres.join(" AND ")}`;
  const sortCol = VALID_SORT[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active, l.deleted_at,
      ${firstBackupImageIdExpr} as first_backup_image_id,
      COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as ListingRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getOwnListings(filters: ListingFilters = {}) {
  const {
    make = "",
    model = "",
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
    kaparo = "",
    sort = "last_edit",
    order = "desc",
    search = "",
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = [
    "(l.is_active = 1 OR l.id IS NULL)",
    "d.active = 1",
    "d.own = 1",
    notDuplicateLExpr,
  ];
  const params: (string | number)[] = [];

  if (make) {
    wheres.push("COALESCE(b.make, l.make) = ?");
    params.push(make);
  }
  if (model) {
    wheres.push("COALESCE(b.model, l.model) = ?");
    params.push(model);
  }

  if (statuses.length > 0) {
    const ph = statuses.map(() => "?").join(",");
    wheres.push(`COALESCE(b.ad_status, l.ad_status) IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes("null");
    const nonNull = vatValues.filter((v) => v !== "null");
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => "?").join(",");
      clauses.push(`(CASE
        WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
        WHEN b.vat_included IN (1, '1') THEN 'included'
        WHEN b.vat_included IN (0, '0') THEN 'exempt'
        ELSE l.vat
      END) IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull)
      clauses.push(`(CASE
      WHEN b.vat_included IN ('included', 'exempt', 'excluded') THEN b.vat_included
      WHEN b.vat_included IN (1, '1') THEN 'included'
      WHEN b.vat_included IN (0, '0') THEN 'exempt'
      ELSE l.vat
    END) IS NULL`);
    if (clauses.length > 0) wheres.push(`(${clauses.join(" OR ")})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => "?").join(",");
    wheres.push(`COALESCE(b.fuel, l.fuel) IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(
      () => "COALESCE(b.extras_json, l.extras_json) LIKE ?",
    );
    wheres.push(`(${clauses.join(" OR ")})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) {
    wheres.push("COALESCE(b.price_amount, l.current_price) >= ?");
    params.push(priceMin);
  }
  if (priceMax !== null) {
    wheres.push("COALESCE(b.price_amount, l.current_price) <= ?");
    params.push(priceMax);
  }
  if (priceChangeMin !== null || priceChangeMax !== null) {
    wheres.push("l.price_change IS NOT NULL");
    if (priceChangeMin !== null) {
      wheres.push("l.price_change >= ?");
      params.push(priceChangeMin);
    }
    if (priceChangeMax !== null) {
      wheres.push("l.price_change <= ?");
      params.push(priceChangeMax);
    }
  }
  if (kaparo) {
    wheres.push("COALESCE(b.kaparo, l.kaparo) = ?");
    params.push(kaparo === "yes" ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => "?").join(",");
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push(
      "(COALESCE(b.title, l.title) LIKE ? OR COALESCE(b.make, l.make) LIKE ? OR COALESCE(b.model, l.model) LIKE ?)",
    );
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => "?").join(",");
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }

  const ownSortCol =
    (
      {
        price: "COALESCE(b.price_amount, l.current_price)",
        last_edit: "l.last_edit",
        carsbg_created_date: "l.carsbg_created_date",
        views: "COALESCE(b.views, l.views)",
        mileage: "COALESCE(b.mileage, l.mileage)",
        fuel: "COALESCE(b.fuel, l.fuel)",
        dealer: "d.priority DESC, d.name",
        ad_status: "COALESCE(b.ad_status, l.ad_status)",
        kaparo: "COALESCE(b.kaparo, l.kaparo)",
        reg_year: "l.reg_year",
      } as Record<string, string>
    )[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    ${rankedBackupsCte}
    SELECT
      COUNT(*) OVER() as total_count,
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
    LEFT JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
    ORDER BY (l.id IS NULL) DESC, ${ownSortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as Array<OwnListingRow & { total_count: number }>;

  const countOwnListings = () => {
    const { count } = raw
      .prepare(
        `
    ${rankedBackupsCte}
    SELECT COUNT(*) as count
    FROM ranked_backups b
    LEFT JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
  `,
      )
      .get(...params) as { count: number };
    return count;
  };

  const total = rows[0]?.total_count ?? (page > 1 ? countOwnListings() : 0);
  const data = rows.map((row) => {
    const listing = { ...row } as Partial<OwnListingRow & { total_count: number }>;
    delete listing.total_count;
    return listing as OwnListingRow;
  });

  return { data, total, page, limit };
}
