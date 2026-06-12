import { raw } from '@/db/client';
import type { ListingFilters, ListingListRow, OwnListingRow } from '../types';
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
  toListingFtsQuery,
} from './list-filters';
import { timedQuery } from '../query-utils';
import { decodeListingCursor, encodeListingCursor } from '@/lib/listing-url';

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
  json_extract(l.thumb_keys, '$[0]') as first_thumb_key,
  json_extract(l.full_keys, '$[0]') as first_full_key,
  json_extract(l.image_meta, '$.cdn') as image_cdn,
  json_extract(l.image_meta, '$.shard') as image_shard,
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

const LISTING_CURSOR_COLUMNS: Record<string, string> = {
  price: 'l.current_price',
  last_edit: 'l.last_edit',
  carsbg_created_date: 'l.carsbg_created_date',
  views: 'l.views',
  mileage: 'l.mileage',
  fuel: 'l.fuel',
  ad_status: 'l.ad_status',
  kaparo: 'l.kaparo',
  reg_year: 'l.reg_year',
};

function addListingCursorFilter({
  wheres,
  params,
  sort,
  order,
  cursor,
}: {
  wheres: string[];
  params: (string | number)[];
  sort: string;
  order: string;
  cursor?: string;
}): boolean {
  const decoded = decodeListingCursor(cursor);
  const sortCol = LISTING_CURSOR_COLUMNS[sort];
  if (!decoded || !sortCol || decoded.sort !== sort || decoded.order !== order || decoded.value == null) {
    return false;
  }

  const operator = order === 'asc' ? '>' : '<';
  wheres.push(`(${sortCol} ${operator} ? OR (${sortCol} = ? AND l.id ${operator} ?))`);
  params.push(decoded.value, decoded.value, decoded.id);
  return true;
}

function getListingCursor(
  row: ListingListRow | undefined,
  sort: string,
  order: string,
): string | null {
  if (!row || !LISTING_CURSOR_COLUMNS[sort]) return null;

  const keyBySort: Record<string, keyof ListingListRow> = {
    price: 'current_price',
    last_edit: 'last_edit',
    carsbg_created_date: 'carsbg_created_date',
    views: 'views',
    mileage: 'mileage',
    fuel: 'fuel',
    ad_status: 'ad_status',
    kaparo: 'kaparo',
    reg_year: 'reg_year',
  };
  const key = keyBySort[sort];
  const value = key ? row[key] : null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  return encodeListingCursor({ sort, order, value, id: row.id });
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
  const { sort = options.defaultSort, order = "desc", page = 1, limit = options.defaultLimit, cursor } = filters;
  const { wheres, params } = buildListingFilters(filters, [
    ...options.initialWheres,
  ], { includeSearch: false });
  const ftsQuery = filters.search ? toListingFtsQuery(filters.search) : "";
  const ftsJoin = ftsQuery
    ? `JOIN listings_search_fts fts ON fts.rowid = l.id AND listings_search_fts MATCH ?`
    : "";

  const usesCursor = addListingCursorFilter({ wheres, params, sort, order, cursor });
  const queryParams = ftsQuery ? [ftsQuery, ...params] : params;
  const where = `WHERE ${wheres.join(" AND ")}`;
  const sortCol = LISTING_SORT_COLUMNS[sort] ?? "l.last_edit";
  const sortDir = order === "asc" ? "ASC" : "DESC";
  const offset = usesCursor ? 0 : (page - 1) * limit;
  const queryLimit = limit + 1;
  const deletedAtSelect = options.includeDeletedAt ? ", l.deleted_at" : "";

  const queryDetails = {
    sort,
    order,
    page,
    limit,
    cursor: Boolean(cursor),
    search: Boolean(filters.search),
    filters: {
      make: Boolean(filters.make),
      model: Boolean(filters.model),
      dealers: filters.dealerSlugs?.length ?? 0,
      years: filters.years?.length ?? 0,
      categories: filters.categories?.length ?? 0,
      statuses: filters.statuses?.length ?? 0,
      vat: filters.vatValues?.length ?? 0,
      fuels: filters.fuels?.length ?? 0,
      extras: filters.extras?.length ?? 0,
    },
  };

  const rows = timedQuery('listings.page', queryDetails, () => raw
      .prepare(
        `
    SELECT
      l.id, l.mobile_id, l.cars_id, l.title, l.make, l.model, l.reg_month, l.reg_year, l.mileage, l.fuel, l.body_type,
      l.vin, l.current_price, l.cars_price, l.price_change, l.vat, l.kaparo, l.ad_status, l.last_edit, l.carsbg_title, l.carsbg_created_date, l.carsbg_edited_date, l.views, l.cars_total_views, l.is_new,
      json_extract(l.thumb_keys, '$[0]') as first_thumb_key,
      json_extract(l.full_keys, '$[0]') as first_full_key,
      json_extract(l.image_meta, '$.cdn') as image_cdn,
      json_extract(l.image_meta, '$.shard') as image_shard,
      l.images_downloaded, l.thumb_saved, l.is_active${deletedAtSelect},
      ${firstBackupImageIdExpr} as first_backup_image_id,
      COALESCE(l.source, 'm') as source,
      d.name as dealer_name, d.slug as dealer_slug
    FROM listings l
    ${ftsJoin}
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
    ORDER BY ${sortCol} ${sortDir}, l.id ${sortDir}
    LIMIT ? OFFSET ?
  `,
      )
      .all(...queryParams, queryLimit, offset) as ListingListRow[]);

  const countListings = () => {
    if (usesCursor) return Math.max(0, offset + Math.min(rows.length, limit));
    const { count } = timedQuery('listings.count', queryDetails, () => raw
        .prepare(
          `
    SELECT COUNT(*) as count
    FROM listings l
    ${ftsJoin}
    LEFT JOIN dealers d ON l.dealer_id = d.id
    ${where}
  `,
        )
        .get(...queryParams) as { count: number });
    return count;
  };

  const pageRows = rows.slice(0, limit);
  const hasNextPage = rows.length > limit;
  const nextCursor = hasNextPage
    ? getListingCursor(pageRows[pageRows.length - 1], sort, order)
    : null;

  return { data: pageRows, total: countListings(), page, limit, nextCursor };
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

  const queryDetails = {
    sort,
    order,
    page,
    limit,
    filters: {
      make: Boolean(filters.make),
      model: Boolean(filters.model),
      dealers: filters.dealerSlugs?.length ?? 0,
      years: filters.years?.length ?? 0,
      statuses: filters.statuses?.length ?? 0,
      vat: filters.vatValues?.length ?? 0,
      fuels: filters.fuels?.length ?? 0,
      extras: filters.extras?.length ?? 0,
    },
  };

  const rows = timedQuery('own-listings.page', queryDetails, () => raw
      .prepare(
        `
    ${rankedBackupsCte}
    SELECT
      ${ownListingSelectColumns}
    ${ownListingFromClause}
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
    ORDER BY (l.id IS NULL) DESC, ${ownSortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `,
      )
      .all(...params, limit, offset) as OwnListingRow[]);

  const countOwnListings = () => {
    const { count } = timedQuery('own-listings.count', queryDetails, () => raw
        .prepare(
          `
    ${rankedBackupsCte}
    SELECT COUNT(*) as count
    ${ownListingFromClause}
    WHERE b.row_num = 1 AND ${wheres.join(" AND ")}
  `,
        )
        .get(...params) as { count: number });
    return count;
  };

  return { data: rows, total: countOwnListings(), page, limit };
}
