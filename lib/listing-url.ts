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
  params.set("page", String(page));
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
