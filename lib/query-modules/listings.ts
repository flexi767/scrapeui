import { raw } from '@/db/client';
import type { ListingFilters, ListingRow, OwnListingRow } from './types';
import { ownNeedsSyncExpr, ownVatExpr } from './types';

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

export function getListings(filters: ListingFilters = {}) {
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
    sort = "price",
    order = "desc",
    search = "",
    page = 1,
    limit = 25,
  } = filters;

  const wheres: string[] = [
    "l.is_active = 1",
    "d.active = 1",
    "(l.duplicate = 0 OR l.duplicate IS NULL)",
  ];
  const params: (string | number)[] = [];

  if (make) {
    wheres.push("l.make = ?");
    params.push(make);
  }
  if (model) {
    wheres.push("l.model = ?");
    params.push(model);
  }
  if (categories.length > 0) {
    const ph = categories.map(() => "?").join(",");
    wheres.push(`l.body_type IN (${ph})`);
    params.push(...categories);
  }

  if (statuses.length > 0) {
    const ph = statuses.map(() => "?").join(",");
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes("null");
    const nonNull = vatValues.filter((v) => v !== "null");
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => "?").join(",");
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push("l.vat IS NULL");
    if (clauses.length > 0) wheres.push(`(${clauses.join(" OR ")})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => "?").join(",");
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(() => "l.extras_json LIKE ?");
    wheres.push(`(${clauses.join(" OR ")})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) {
    wheres.push("l.current_price >= ?");
    params.push(priceMin);
  }
  if (priceMax !== null) {
    wheres.push("l.current_price <= ?");
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
    wheres.push("l.kaparo = ?");
    params.push(kaparo === "yes" ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => "?").join(",");
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push("(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => "?").join(",");
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }
  if (source) {
    wheres.push("l.source = ?");
    params.push(source);
  }

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
      (
        SELECT i.id
        FROM mobilebg_backups b
        JOIN mobilebg_backup_images i ON i.backup_id = b.id
        WHERE b.listing_id = l.id
        ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC, i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id,
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
    sort = "last_edit",
    order = "desc",
    search = "",
    page = 1,
    limit = 50,
  } = filters;

  const wheres: string[] = [
    "l.is_active = 0",
    "l.deleted_at IS NOT NULL",
    "d.active = 1",
    "(l.duplicate = 0 OR l.duplicate IS NULL)",
  ];
  const params: (string | number)[] = [];

  if (make) {
    wheres.push("l.make = ?");
    params.push(make);
  }
  if (model) {
    wheres.push("l.model = ?");
    params.push(model);
  }
  if (categories.length > 0) {
    const ph = categories.map(() => "?").join(",");
    wheres.push(`l.body_type IN (${ph})`);
    params.push(...categories);
  }
  if (statuses.length > 0) {
    const ph = statuses.map(() => "?").join(",");
    wheres.push(`l.ad_status IN (${ph})`);
    params.push(...statuses);
  }
  if (vatValues.length > 0) {
    const includeNull = vatValues.includes("null");
    const nonNull = vatValues.filter((v) => v !== "null");
    const clauses: string[] = [];
    if (nonNull.length > 0) {
      const ph = nonNull.map(() => "?").join(",");
      clauses.push(`l.vat IN (${ph})`);
      params.push(...nonNull);
    }
    if (includeNull) clauses.push("l.vat IS NULL");
    if (clauses.length > 0) wheres.push(`(${clauses.join(" OR ")})`);
  }
  if (fuels.length > 0) {
    const ph = fuels.map(() => "?").join(",");
    wheres.push(`l.fuel IN (${ph})`);
    params.push(...fuels);
  }
  if (extras.length > 0) {
    const clauses = extras.map(() => "l.extras_json LIKE ?");
    wheres.push(`(${clauses.join(" OR ")})`);
    params.push(...extras.map((extra) => `%${extra}%`));
  }
  if (priceMin !== null) {
    wheres.push("l.current_price >= ?");
    params.push(priceMin);
  }
  if (priceMax !== null) {
    wheres.push("l.current_price <= ?");
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
    wheres.push("l.kaparo = ?");
    params.push(kaparo === "yes" ? 1 : 0);
  }
  if (years.length > 0) {
    const ph = years.map(() => "?").join(",");
    wheres.push(`l.reg_year IN (${ph})`);
    params.push(...years);
  }
  if (search) {
    wheres.push("(l.title LIKE ? OR l.make LIKE ? OR l.model LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => "?").join(",");
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }
  if (source) {
    wheres.push("l.source = ?");
    params.push(source);
  }

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
      (
        SELECT i.id
        FROM mobilebg_backups b
        JOIN mobilebg_backup_images i ON i.backup_id = b.id
        WHERE b.listing_id = l.id
        ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC, i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id,
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
    "(l.duplicate = 0 OR l.duplicate IS NULL)",
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
      (
        SELECT i.id
        FROM mobilebg_backup_images i
        WHERE i.backup_id = b.id
        ORDER BY i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id,
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
    .all(...params, limit, offset) as OwnListingRow[];

  const { count } = raw
    .prepare(
      `
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
    LEFT JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}

export function getOwnListingByMobileId(
  mobileId: string,
): OwnListingRow | null {
  return raw
    .prepare(
      `
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
      (
        SELECT i.id
        FROM mobilebg_backup_images i
        WHERE i.backup_id = b.id
        ORDER BY i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id,
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
  first_backup_image_id: number | null;
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

function buildTrackedChangesWhere(filters: TrackedChangesFilters): {
  where: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.make) {
    clauses.push("l.make = ?");
    params.push(filters.make);
  }
  if (filters.model) {
    clauses.push("l.model = ?");
    params.push(filters.model);
  }
  if (filters.dealerSlugs && filters.dealerSlugs.length > 0) {
    clauses.push(
      `d.slug IN (${filters.dealerSlugs.map(() => "?").join(", ")})`,
    );
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
    clauses.push("s.recorded_at >= ? AND s.recorded_at <= ?");
    params.push(filters.whenStart, filters.whenEnd);
  }
  if (filters.fields && filters.fields.length > 0) {
    const fieldMap: Record<string, string> = {
      price: "s.price IS NOT NULL",
      vat: "s.vat IS NOT NULL",
      last_edit: "s.last_edit IS NOT NULL",
      views: "s.views IS NOT NULL",
      ad_status: "s.ad_status IS NOT NULL",
      kaparo: "s.kaparo IS NOT NULL",
      title: `s.title IS NOT NULL AND TRIM(s.title) != ''`,
      description: `s.description IS NOT NULL AND TRIM(s.description) != ''`,
    };
    const selectedClauses = filters.fields
      .map((field) => fieldMap[field])
      .filter(Boolean);
    if (selectedClauses.length > 0)
      clauses.push(`(${selectedClauses.join(" OR ")})`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function getTrackedChangeWindows(): TrackedChangeWindow[] {
  const rows = raw
    .prepare(
      `
    SELECT recorded_at
    FROM listing_snapshots
    ORDER BY recorded_at DESC, id DESC
  `,
    )
    .all() as { recorded_at: string }[];

  const windows: TrackedChangeWindow[] = [];
  const windowMs = 10 * 60 * 1000;
  let current: {
    latestMs: number;
    latest: string;
    earliestMs: number;
    earliest: string;
    count: number;
  } | null = null;

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

export function getTrackedChanges(filters: TrackedChangesFilters = {}): {
  data: TrackedChangeRow[];
  total: number;
} {
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

  const totalRow = raw
    .prepare(
      `
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
  `,
    )
    .get(...params) as { count: number };

  const data = raw
    .prepare(
      `
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
        (
          SELECT i.id
          FROM mobilebg_backups b
          JOIN mobilebg_backup_images i ON i.backup_id = b.id
          WHERE b.listing_id = l.id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC, i.sort_order ASC, i.id ASC
          LIMIT 1
        ) as first_backup_image_id,
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
  `,
    )
    .all(...params, limit, offset) as TrackedChangeRow[];

  return { data, total: totalRow.count };
}
