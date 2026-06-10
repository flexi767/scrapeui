import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";
import { runInsert } from "@/lib/listings/sql";
import { getWindowTotal, omitQueryFields, timedQuery } from "./query-utils";
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
}

export interface PublicListingsResult {
  listings: PublicListing[];
  total: number;
  page: number;
  limit: number;
  makes: string[];
}

// ── Allowed sort fields (whitelist) ────────────────────────────────────────

const ALLOWED_SORT: Record<string, string> = {
  newest: "l.last_edit DESC",
  price_asc: "l.current_price ASC",
  price_desc: "l.current_price DESC",
  mileage_asc: "l.mileage ASC",
  year_desc: "l.reg_year DESC",
};

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
  const row = raw
    .prepare(`SELECT ${DEALER_SELECT} FROM dealers WHERE slug = ? AND active = 1 LIMIT 1`)
    .get(slug) as (PublicDealer & { publicContentRaw?: string | null }) | undefined;
  return hydrateDealer(row);
}

export function getDealerByDomain(domain: string): PublicDealer | null {
  const row = raw
    .prepare(`SELECT ${DEALER_SELECT} FROM dealers WHERE public_domain = ? AND public_enabled = 1 AND active = 1 LIMIT 1`)
    .get(domain) as (PublicDealer & { publicContentRaw?: string | null }) | undefined;
  return hydrateDealer(row);
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
  return raw
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
    .all(dealerId, make, excludeMobileId, limit) as PublicListing[];
}

export function getPublicListings(
  dealerId: number,
  filters: PublicListingFilters = {},
): PublicListingsResult {
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

  const orderBy = ALLOWED_SORT[sort] ?? ALLOWED_SORT.newest;
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(48, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

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
    },
  };

  const rows = timedQuery("public.listings.page", queryDetails, () => raw
      .prepare(
        `SELECT
        COUNT(*) OVER() as totalCount,
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
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      )
      .all(...params, safeLimit, offset) as Array<PublicListing & { totalCount: number }>);

  const countListings = () => {
    const row = timedQuery("public.listings.count", queryDetails, () => raw
        .prepare(`SELECT COUNT(*) as n FROM listings l WHERE ${where}`)
        .get(...params) as { n: number });
    return row.n;
  };

  // Available makes for filter dropdown
  const makeRows = raw
    .prepare(
      `SELECT DISTINCT make FROM listings
       WHERE dealer_id = ? AND is_active = 1 AND make IS NOT NULL
       ORDER BY make`,
    )
    .all(dealerId) as { make: string }[];

  return {
    listings: rows.map((row) => omitQueryFields(row, ['totalCount'])),
    total: getWindowTotal(rows, safePage, countListings, 'totalCount'),
    page: safePage,
    limit: safeLimit,
    makes: makeRows.map((r) => r.make),
  };
}

export function getPublicListing(
  dealerId: number,
  mobileId: string,
): PublicListingDetail | null {
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
}
