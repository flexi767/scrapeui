import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";
import { decodeListingCursor, encodeListingCursor } from "@/lib/listing-url";
import { runInsert } from "@/lib/listings/sql";
import { createTtlCache } from "@/lib/ttl-cache";
import { timedQuery } from "./query-utils";
import { notDuplicateLExpr } from "./types";

// ── Types ──────────────────────────────────────────────────────────────────

/** Editable per-dealer copy for the static public inner pages. */
export interface DealerPublicContent {
  about?: string;
  finance?: string;
  privacy?: string;
  terms?: string;
}

export interface PublicDealer {
  id: number;
  slug: string;
  name: string;
  template: string;
  publicDomain: string | null;
  publicEnabled: number;
  activeTemplateConfigId: number | null;
  mobileUrl: string | null;
  publicContent: DealerPublicContent | null;
}

export interface PublicListing {
  id?: number;
  mobileId: string;
  make: string | null;
  model: string | null;
  regYear: string | null;
  fuel: string | null;
  transmission: string | null;
  mileage: number | null;
  currentPrice: number | null;
  imageCount: number | null;
  thumbKeys?: string | null;
  fullKeys?: string | null;
  imageMeta?: string | null;
  firstThumbKey?: string | null;
  firstFullKey?: string | null;
  imageCdn?: string | null;
  imageShard?: string | null;
  imagesDownloaded: number | null;
  thumbSaved: number | null;
  isNew: number | null;
  bodyType: string | null;
  lastEdit?: string | null;
}

export interface PublicListingDetail extends PublicListing {
  power: number | null;
  color: string | null;
  vin: string | null;
  euronorm: number | null;
  description: string | null;
  extrasJson: string | null;
  regMonth: string | null;
}

export interface PublicListingFilters {
  make?: string;
  fuel?: string;
  yearFrom?: string;
  yearTo?: string;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  sort?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PublicListingsResult {
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  nextCursor: string | null;
  makes: string[];
}

// ── TTL caches ─────────────────────────────────────────────────────────────
// Public dealer pages are force-dynamic but change only when a scrape runs.
// A 60 s TTL reduces SQLite pressure under traffic spikes while keeping data
// fresh enough for the app's scrape cadence. These caches are single-node /
// in-process only (see CLAUDE.md).

const dealerBySlugCache = createTtlCache<PublicDealer | null>({ ttlMs: 60_000, maxEntries: 200 });
const dealerByDomainCache = createTtlCache<PublicDealer | null>({ ttlMs: 60_000, maxEntries: 200 });
const publicListingsCache = createTtlCache<PublicListingsResult>({ ttlMs: 60_000, maxEntries: 500 });
const publicListingCache = createTtlCache<PublicListingDetail | null>({ ttlMs: 60_000, maxEntries: 2000 });
const relatedListingsCache = createTtlCache<PublicListing[]>({ ttlMs: 60_000, maxEntries: 1000 });

// ── Allowed sort fields (whitelist) ────────────────────────────────────────

const ALLOWED_SORT: Record<string, string> = {
  newest: "l.last_edit DESC, l.id DESC",
  price_asc: "l.current_price ASC, l.id ASC",
  price_desc: "l.current_price DESC, l.id DESC",
  mileage_asc: "l.mileage ASC, l.id ASC",
  year_desc: "l.reg_year DESC, l.id DESC",
};

const PUBLIC_CURSOR_COLUMNS: Record<string, { column: string; key: keyof PublicListing; order: "asc" | "desc" }> = {
  newest: { column: "l.last_edit", key: "lastEdit", order: "desc" },
  price_asc: { column: "l.current_price", key: "currentPrice", order: "asc" },
  price_desc: { column: "l.current_price", key: "currentPrice", order: "desc" },
  mileage_asc: { column: "l.mileage", key: "mileage", order: "asc" },
  year_desc: { column: "l.reg_year", key: "regYear", order: "desc" },
};

function addPublicCursorFilter(
  wheres: string[],
  params: (string | number)[],
  sort: string,
  cursor?: string,
): boolean {
  const cursorConfig = PUBLIC_CURSOR_COLUMNS[sort] ?? PUBLIC_CURSOR_COLUMNS.newest;
  const decoded = decodeListingCursor(cursor);
  if (!decoded || decoded.sort !== sort || decoded.order !== cursorConfig.order || decoded.value == null) {
    return false;
  }

  const operator = cursorConfig.order === "asc" ? ">" : "<";
  wheres.push(`(${cursorConfig.column} ${operator} ? OR (${cursorConfig.column} = ? AND l.id ${operator} ?))`);
  params.push(decoded.value, decoded.value, decoded.id);
  return true;
}

function getPublicNextCursor(row: PublicListing | undefined, sort: string): string | null {
  const cursorConfig = PUBLIC_CURSOR_COLUMNS[sort] ?? PUBLIC_CURSOR_COLUMNS.newest;
  if (!row?.id) return null;
  const value = row[cursorConfig.key];
  if (typeof value !== "string" && typeof value !== "number") return null;
  return encodeListingCursor({ sort, order: cursorConfig.order, value, id: row.id });
}

// ── Queries ────────────────────────────────────────────────────────────────

const DEALER_SELECT = `
  id, slug, name,
  COALESCE(template, 'bold') as template,
  public_domain as publicDomain,
  COALESCE(public_enabled, 0) as publicEnabled,
  active_template_config_id as activeTemplateConfigId,
  mobile_url as mobileUrl,
  public_content as publicContentRaw`;

/** Parse the stored JSON content blob, tolerating null/legacy/invalid values. */
function hydrateDealer(row: (PublicDealer & { publicContentRaw?: string | null }) | undefined): PublicDealer | null {
  if (!row) return null;
  const { publicContentRaw, ...dealer } = row;
  let publicContent: DealerPublicContent | null = null;
  if (publicContentRaw) {
    try {
      const parsed = JSON.parse(publicContentRaw);
      if (parsed && typeof parsed === "object") publicContent = parsed as DealerPublicContent;
    } catch {
      publicContent = null;
    }
  }
  return { ...dealer, publicContent };
}

export function getPublicDealer(slug: string): PublicDealer | null {
  return dealerBySlugCache.get(slug, () => {
    const row = raw
      .prepare(`SELECT ${DEALER_SELECT} FROM dealers WHERE slug = ? AND active = 1 LIMIT 1`)
      .get(slug) as (PublicDealer & { publicContentRaw?: string | null }) | undefined;
    return hydrateDealer(row);
  });
}

export function getDealerByDomain(domain: string): PublicDealer | null {
  return dealerByDomainCache.get(domain, () => {
    const row = raw
      .prepare(`SELECT ${DEALER_SELECT} FROM dealers WHERE public_domain = ? AND public_enabled = 1 AND active = 1 LIMIT 1`)
      .get(domain) as (PublicDealer & { publicContentRaw?: string | null }) | undefined;
    return hydrateDealer(row);
  });
}

export interface DealerEnquiryInput {
  dealerId: number;
  name: string;
  email: string;
  message: string;
}

export function createDealerEnquiry(input: DealerEnquiryInput): number {
  const result = runInsert(raw, "dealer_enquiries", {
    dealer_id: input.dealerId,
    name: input.name,
    email: input.email,
    message: input.message,
    created_at: currentIsoTimestamp(),
  });
  return Number(result.lastInsertRowid);
}

export function getRelatedListings(
  dealerId: number,
  excludeMobileId: string,
  make: string | null,
  limit = 6,
): PublicListing[] {
  if (!make) return [];
  const key = `${dealerId}:${excludeMobileId}:${make}:${limit}`;
  return relatedListingsCache.get(key, () => raw
      .prepare(
        `SELECT
        l.mobile_id as mobileId,
        l.make, l.model, l.reg_year as regYear, l.fuel,
        l.transmission, l.mileage, l.current_price as currentPrice,
        l.image_count as imageCount,
        json_extract(l.thumb_keys, '$[0]') as firstThumbKey,
        json_extract(l.full_keys, '$[0]') as firstFullKey,
        json_extract(l.image_meta, '$.cdn') as imageCdn,
        json_extract(l.image_meta, '$.shard') as imageShard,
        l.images_downloaded as imagesDownloaded, l.thumb_saved as thumbSaved,
        l.is_new as isNew, l.body_type as bodyType
       FROM listings l
       WHERE l.dealer_id = ? AND l.is_active = 1 AND l.make = ?
         AND l.mobile_id != ?
         AND ${notDuplicateLExpr}
       ORDER BY l.last_edit DESC
       LIMIT ?`,
      )
      .all(dealerId, make, excludeMobileId, limit) as PublicListing[]);
}

export function getPublicListings(
  dealerId: number,
  filters: PublicListingFilters = {},
): PublicListingsResult {
  const key = `${dealerId}:${JSON.stringify(filters)}`;
  return publicListingsCache.get(key, () => {
    const {
      make = "",
      fuel = "",
      yearFrom = "",
      yearTo = "",
      priceMin,
      priceMax,
      mileageMax,
      sort = "newest",
      page = 1,
      limit = 24,
      cursor,
    } = filters;

    const wheres: string[] = [
      "l.dealer_id = ?",
      "l.is_active = 1",
      notDuplicateLExpr,
    ];
    const params: (string | number)[] = [dealerId];

    if (make) { wheres.push("l.make = ?"); params.push(make); }
    if (fuel) { wheres.push("l.fuel = ?"); params.push(fuel); }
    if (yearFrom) { wheres.push("CAST(l.reg_year AS INTEGER) >= ?"); params.push(parseInt(yearFrom, 10)); }
    if (yearTo) { wheres.push("CAST(l.reg_year AS INTEGER) <= ?"); params.push(parseInt(yearTo, 10)); }
    if (priceMin != null) { wheres.push("l.current_price >= ?"); params.push(priceMin); }
    if (priceMax != null) { wheres.push("l.current_price <= ?"); params.push(priceMax); }
    if (mileageMax != null) { wheres.push("l.mileage <= ?"); params.push(mileageMax); }

    const countWhere = wheres.join(" AND ");
    const countParams = [...params];
    const orderBy = ALLOWED_SORT[sort] ?? ALLOWED_SORT.newest;
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(48, Math.max(1, limit));
    const usesCursor = addPublicCursorFilter(wheres, params, sort, cursor);
    const offset = usesCursor ? 0 : (safePage - 1) * safeLimit;
    const queryLimit = safeLimit + 1;

    const where = wheres.join(" AND ");

    const queryDetails = {
      dealerId,
      sort,
      page: safePage,
      limit: safeLimit,
      filters: {
        make: Boolean(make),
        fuel: Boolean(fuel),
        yearFrom: Boolean(yearFrom),
        yearTo: Boolean(yearTo),
        priceMin: priceMin != null,
        priceMax: priceMax != null,
        mileageMax: mileageMax != null,
        cursor: usesCursor,
      },
    };

    const rows = timedQuery("public.listings.page", queryDetails, () => raw
        .prepare(
          `SELECT
        l.id,
        l.mobile_id as mobileId,
        l.make, l.model, l.reg_year as regYear, l.fuel,
        l.transmission, l.mileage, l.current_price as currentPrice,
        l.image_count as imageCount,
        json_extract(l.thumb_keys, '$[0]') as firstThumbKey,
        json_extract(l.full_keys, '$[0]') as firstFullKey,
        json_extract(l.image_meta, '$.cdn') as imageCdn,
        json_extract(l.image_meta, '$.shard') as imageShard,
        l.images_downloaded as imagesDownloaded, l.thumb_saved as thumbSaved,
        l.last_edit as lastEdit,
        l.is_new as isNew, l.body_type as bodyType
       FROM listings l
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
        )
        .all(...params, queryLimit, offset) as PublicListing[]);

    const countListings = () => {
      const row = timedQuery("public.listings.count", queryDetails, () => raw
          .prepare(`SELECT COUNT(*) as n FROM listings l WHERE ${countWhere}`)
          .get(...countParams) as { n: number });
      return row.n;
    };

    const makeRows = raw
      .prepare(
        `SELECT DISTINCT make FROM listings
       WHERE dealer_id = ? AND is_active = 1 AND make IS NOT NULL
       ORDER BY make`,
      )
      .all(dealerId) as { make: string }[];

    const pageRows = rows.slice(0, safeLimit);
    const hasNextPage = rows.length > safeLimit;

    return {
      listings: pageRows,
      total: countListings(),
      page: safePage,
      limit: safeLimit,
      nextCursor: hasNextPage ? getPublicNextCursor(pageRows[pageRows.length - 1], sort) : null,
      makes: makeRows.map((r) => r.make),
    };
  });
}

export function getPublicListing(
  dealerId: number,
  mobileId: string,
): PublicListingDetail | null {
  const key = `${dealerId}:${mobileId}`;
  return publicListingCache.get(key, () => {
    const row = raw
      .prepare(
        `SELECT
        l.mobile_id as mobileId,
        l.make, l.model, l.reg_year as regYear, l.reg_month as regMonth,
        l.fuel, l.transmission, l.mileage, l.current_price as currentPrice,
        l.image_count as imageCount, l.thumb_keys as thumbKeys,
        l.full_keys as fullKeys, l.image_meta as imageMeta,
        l.images_downloaded as imagesDownloaded, l.thumb_saved as thumbSaved,
        l.is_new as isNew, l.body_type as bodyType,
        l.power, l.color, l.vin, l.euronorm,
        l.description, l.extras_json as extrasJson
       FROM listings l
       WHERE l.dealer_id = ? AND l.mobile_id = ? AND l.is_active = 1
       LIMIT 1`,
      )
      .get(dealerId, mobileId) as PublicListingDetail | undefined;
    return row ?? null;
  });
}
