import type { MobileBgSearchFieldInput } from "@/lib/mobile-bg/search-results";
import type { MobileBgSearchResultsResponse } from "@/components/saved-searches/api";
import { parseJson } from "@/lib/utils";

export const MOBILE_BG_BROWSER_RESULTS_MESSAGE =
  "scrapeui:mobile-bg-search-results";
export const MOBILE_BG_BROWSER_SEARCH_WINDOW_NAME_PREFIX =
  "scrapeui-mobile-bg-search:";

export interface MobileBgBrowserSearchContext {
  appOrigin: string;
  token: string;
  fields: MobileBgSearchFieldInput[];
}

export interface MobileBgBrowserResultsMessage {
  type: typeof MOBILE_BG_BROWSER_RESULTS_MESSAGE;
  token: string;
  payload: {
    submitted_fields: MobileBgSearchFieldInput[];
    summary_text: string | null;
    page: number;
    total_pages: number | null;
    has_next_page: boolean;
    count_on_page: number;
    loaded_until_page: number;
    ignored_search_result_ids: string[];
    rows: Array<{
      mobile_id: string;
      original_position: number;
      url: string;
      thumb: string | null;
      title: string;
      make: string | null;
      model: string | null;
      dealer_name: string | null;
      dealer_url: string | null;
      current_price: number | null;
      vat_status: "included" | "exempt" | "excluded" | null;
      ad_status: string;
      reg_month: string | null;
      reg_year: string | null;
      body_type: string | null;
      fuel: string | null;
      mileage: number | null;
      transmission: string | null;
      power: number | null;
    }>;
    fallback_note: string;
  };
}

export function buildMobileBgBrowserSearchWindowName(
  context: MobileBgBrowserSearchContext,
) {
  return `${MOBILE_BG_BROWSER_SEARCH_WINDOW_NAME_PREFIX}${JSON.stringify(context)}`;
}

export function getMobileBgBrowserResultsStorageKey(searchId: number) {
  return `scrapeui.savedSearch.browserResults.${searchId}`;
}

export function persistMobileBgBrowserResults(
  searchId: number,
  payload: MobileBgSearchResultsResponse | null,
) {
  if (typeof window === "undefined") return;
  try {
    if (payload) {
      window.localStorage.setItem(
        getMobileBgBrowserResultsStorageKey(searchId),
        JSON.stringify(payload),
      );
    } else {
      window.localStorage.removeItem(getMobileBgBrowserResultsStorageKey(searchId));
    }
  } catch {}
}

export function readMobileBgBrowserResults(searchId: number) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      getMobileBgBrowserResultsStorageKey(searchId),
    );
    return parseJson<MobileBgSearchResultsResponse | null>(raw, null);
  } catch {
    return null;
  }
}

export function mergeMobileBgBrowserResults(
  previous: MobileBgSearchResultsResponse | null,
  incoming: MobileBgSearchResultsResponse,
): MobileBgSearchResultsResponse {
  if (!previous?.rows.length) return incoming;
  const rowsById = new Map(previous.rows.map((row) => [row.mobile_id, row]));
  for (const row of incoming.rows) rowsById.set(row.mobile_id, row);
  const rows = Array.from(rowsById.values()).map((row, index) => ({
    ...row,
    original_position: index + 1,
  }));
  return {
    ...incoming,
    page: previous.page,
    total_pages: incoming.total_pages ?? previous.total_pages,
    has_next_page: incoming.has_next_page,
    count_on_page: rows.length,
    loaded_until_page: Math.max(
      previous.loaded_until_page ?? previous.page,
      incoming.loaded_until_page ?? incoming.page,
    ),
    ignored_search_result_ids: [
      ...new Set([
        ...(previous.ignored_search_result_ids ?? []),
        ...(incoming.ignored_search_result_ids ?? []),
      ]),
    ],
    rows,
  };
}
