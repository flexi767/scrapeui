export interface ListingSearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  year?: string | string[];
  category?: string | string[];
  status?: string | string[];
  vat?: string | string[];
  fuel?: string | string[];
  extra?: string | string[];
  kaparo?: string;
  p_min?: string;
  p_max?: string;
  pc_min?: string;
  pc_max?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: string;
  cursor?: string;
}

export function parseListingSearchParams(sp: ListingSearchParams, defaultSort = 'last_edit') {
  return {
    make: sp.make ?? '',
    model: sp.model ?? '',
    dealerSlugs: toParamArray(sp.dealer),
    years: toParamArray(sp.year),
    categories: toParamArray(sp.category),
    statuses: toParamArray(sp.status),
    vatValues: toParamArray(sp.vat),
    fuels: toParamArray(sp.fuel),
    extras: toParamArray(sp.extra),
    priceMin: parseOptionalNum(sp.p_min),
    priceMax: parseOptionalNum(sp.p_max),
    priceChangeMin: parseOptionalNum(sp.pc_min),
    priceChangeMax: parseOptionalNum(sp.pc_max),
    kaparo: sp.kaparo ?? '',
    sort: sp.sort ?? defaultSort,
    order: sp.order ?? 'desc',
    search: sp.search ?? '',
    page: parseInt(sp.page ?? '1', 10),
    cursor: sp.cursor ?? '',
  };
}

export const LISTING_EXTRA_OPTIONS = [
  "4x4",
  "С регистрация",
  "Нов внос",
  "Кожен салон",
];

export function toParamArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export function parseOptionalNum(value: string | undefined | null): number | null {
  return value !== undefined && value !== null ? Number(value) : null;
}

export function buildListingParams({
  statuses,
  vatValues,
  categories,
  fuels,
  extras,
  kaparo,
  make,
  model,
  dealerSlugs,
  years,
  search,
  sort,
  order,
}: {
  statuses: string[];
  vatValues: string[];
  categories: string[];
  fuels: string[];
  extras: string[];
  kaparo: string;
  make: string;
  model: string;
  dealerSlugs: string[];
  years: string[];
  search: string;
  sort: string;
  order: string;
}) {
  const params = new URLSearchParams();
  for (const value of statuses) params.append("status", value);
  for (const value of vatValues) params.append("vat", value);
  for (const value of categories) params.append("category", value);
  for (const value of fuels) params.append("fuel", value);
  for (const value of extras) params.append("extra", value);
  if (kaparo) params.set("kaparo", kaparo);
  if (make) params.set("make", make);
  if (model) params.set("model", model);
  for (const value of dealerSlugs) params.append("dealer", value);
  for (const value of years) params.append("year", value);
  if (search) params.set("search", search);
  params.set("sort", sort);
  params.set("order", order);
  return params;
}

export function listingHref(
  basePath: string,
  currentParams: URLSearchParams,
  updates: Record<string, string | number | null | undefined>,
  omit: string[] = [],
) {
  const params = new URLSearchParams(currentParams.toString());
  params.delete("page");
  for (const key of omit) params.delete(key);
  for (const [key, value] of Object.entries(updates)) {
    params.delete(key);
    if (value != null && value !== "") params.append(key, String(value));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function listingPageHref(
  basePath: string,
  currentParams: URLSearchParams,
  page: number,
) {
  const params = new URLSearchParams(currentParams.toString());
  params.delete("cursor");
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export function listingCursorHref(
  basePath: string,
  currentParams: URLSearchParams,
  cursor: string,
) {
  const params = new URLSearchParams(currentParams.toString());
  params.delete("page");
  params.set("cursor", cursor);
  return `${basePath}?${params.toString()}`;
}

export function listingSortHref({
  basePath,
  currentParams,
  sortKey,
  currentSort,
  currentOrder,
}: {
  basePath: string;
  currentParams: URLSearchParams;
  sortKey: string;
  currentSort: string;
  currentOrder: string;
}) {
  const params = new URLSearchParams(currentParams.toString());
  params.delete("page");
  params.delete("cursor");
  if (currentSort === sortKey) {
    params.set("order", currentOrder === "asc" ? "desc" : "asc");
  } else {
    params.set("sort", sortKey);
    params.set("order", "desc");
  }
  return `${basePath}?${params.toString()}`;
}

export function sortArrow(sortKey: string, currentSort: string, currentOrder: string) {
  return currentSort === sortKey ? (currentOrder === "asc" ? " ↑" : " ↓") : "";
}

export interface ListingCursor {
  sort: string;
  order: string;
  value: string | number | null;
  id: number;
}

export function encodeListingCursor(cursor: ListingCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeListingCursor(value: string | null | undefined): ListingCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ListingCursor>;
    if (
      typeof parsed.sort !== "string"
      || typeof parsed.order !== "string"
      || typeof parsed.id !== "number"
    ) {
      return null;
    }
    return {
      sort: parsed.sort,
      order: parsed.order === "asc" ? "asc" : "desc",
      value: typeof parsed.value === "number" || typeof parsed.value === "string" ? parsed.value : null,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}
