import { raw } from '@/db/client';
import type { ListingFilters, ListingRow, OwnListingRow } from '../types';
import {
  firstBackupImageIdExpr,
  firstBackupImageIdFromBackupExpr,
  notDuplicateLExpr,
  ownAdStatusExpr,
  ownBodyTypeExpr,
  ownEffectiveVatExpr,
  ownFuelExpr,
  ownKaparoExpr,
  ownMakeExpr,
  ownMileageExpr,
  ownModelExpr,
  ownNeedsSyncExpr,
  ownPriceExpr,
  ownTitleExpr,
  ownViewsExpr,
  rankedBackupsCte,
} from '../types';
import {
  buildListingFilters,
  buildOwnListingFilters,
  LISTING_SORT_COLUMNS,
  OWN_LISTING_SORT_COLUMNS,
} from './list-filters';

const ownListingFromClause = `
  FROM ranked_backups b
  LEFT JOIN listings l ON l.id = b.listing_id
  LEFT JOIN dealers d ON b.dealer_id = d.id
`;

const ownListingSelectColumns = `
  b.id as backup_id,
  l.id, l.mobile_id,
  ${ownTitleExpr} as title,
  ${ownMakeExpr} as make,
  ${ownModelExpr} as model,
  l.reg_month, l.reg_year,
  ${ownMileageExpr} as mileage,
  ${ownBodyTypeExpr} as body_type,
  ${ownFuelExpr} as fuel,
  ${ownPriceExpr} as current_price,
  l.price_change,
  ${ownEffectiveVatExpr} as vat,
  ${ownKaparoExpr} as kaparo,
  ${ownAdStatusExpr} as ad_status,
  l.last_edit,
  l.carsbg_title,
  l.carsbg_created_date,
  l.carsbg_edited_date,
  ${ownViewsExpr} as views,
  l.cars_total_views,
  b.watching as watching,
  l.is_new,
  l.thumb_keys,
  l.full_keys,
  l.image_meta,
  l.images_downloaded,
  l.thumb_saved,
  l.is_active,
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
  d.name as dealer_name,
  d.slug as dealer_slug
`;

function stripTotalCount<T extends { total_count: number }>(row: T): Omit<T, 'total_count'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { total_count, ...rest } = row;
  return rest;
}

function getListingPage(
  filters: ListingFilters,
  options: {
    defaultSort: string;
    defaultLimit: number;
    initialWheres: string[];
    includeDeletedAt?: boolean;
  },
) {
  const { sort = options.defaultSort, order = "desc", page = 1, limit = options.defaultLimit } = filters;
  const { wheres, params } = buildListingFilters(filters, [
    ...options.initialWheres,
  ]);

  const where = `WHERE ${wheres.join(" AND ")}`;
  const sortCol = LISTING_SORT_COLUMNS[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;
  const deletedAtSelect = options.includeDeletedAt ? ", l.deleted_at" : "";

  const rows = raw
    .prepare(
      `
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved, l.is_active${deletedAtSelect},
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

export function getListings(filters: ListingFilters = {}) {
  return getListingPage(filters, {
    defaultSort: "price",
    defaultLimit: 25,
    initialWheres: [
      "l.is_active = 1",
      "d.active = 1",
      notDuplicateLExpr,
    ],
  });
}

export function getDeletedListings(filters: ListingFilters = {}) {
  return getListingPage(filters, {
    defaultSort: "last_edit",
    defaultLimit: 50,
    initialWheres: [
      "l.is_active = 0",
      "l.deleted_at IS NOT NULL",
      "d.active = 1",
      notDuplicateLExpr,
    ],
    includeDeletedAt: true,
  });
}

export function getOwnListings(filters: ListingFilters = {}) {
  const {
    sort = "last_edit",
    order = "desc",
    page = 1,
    limit = 25,
  } = filters;

  const { wheres, params } = buildOwnListingFilters(filters, [
    "(l.is_active = 1 OR l.id IS NULL)",
    "d.active = 1",
    "d.own = 1",
    notDuplicateLExpr,
  ]);

  const ownSortCol = OWN_LISTING_SORT_COLUMNS[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    ${rankedBackupsCte}
    SELECT
      COUNT(*) OVER() as total_count,
      ${ownListingSelectColumns}
    ${ownListingFromClause}
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
    ${ownListingFromClause}
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
  `,
      )
      .get(...params) as { count: number };
    return count;
  };

  const total = rows[0]?.total_count ?? (page > 1 ? countOwnListings() : 0);
  const data = rows.map((row) => stripTotalCount(row) as OwnListingRow);

  return { data, total, page, limit };
}
