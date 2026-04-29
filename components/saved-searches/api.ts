import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { MobileBgSearchResultsPayload } from "@/lib/mobile-bg/search-results";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";

export interface SavedSearchDetailResponse {
  detail: {
    search: {
      id: number;
      listingId: number | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
    prefill: SearchPrefillData;
  };
}

export interface SavedSearchListResponse {
  searches: SavedSearchSummary[];
}

export interface SavedSearchMutationResponse
  extends SavedSearchListResponse,
    SavedSearchDetailResponse {}

export interface MobileBgSearchResultsResponse
  extends MobileBgSearchResultsPayload {
  fallback_note?: string | null;
}

export interface LocationOptionsResponse {
  label: string;
  options: Array<{ value: string; label: string }>;
}

type SavedSearchDeleteResponse = SavedSearchListResponse;

async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

async function parseJsonResponse<T>(response: Response, fallbackError: string) {
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallbackError);
  }
  return payload as T;
}

export async function fetchSavedSearchDetail(id: number) {
  const response = await fetch(`/api/saved-searches/${id}`);
  return parseJsonResponse<SavedSearchDetailResponse>(
    response,
    "Failed to load saved search",
  );
}

export async function fetchLocationOptions(value: string) {
  const params = new URLSearchParams();
  if (value) params.set("location", value);
  const response = await fetch(
    `/api/mobile-bg/location-options?${params.toString()}`,
  );
  return parseJsonResponse<LocationOptionsResponse>(
    response,
    "Failed to load location options",
  );
}

export async function fetchMobileBgSearchResults({
  action,
  method,
  fields,
  sourceListingId,
  sourceMobileId,
}: {
  action: string;
  method: "POST";
  fields: SearchField[];
  sourceListingId: number | null;
  sourceMobileId: string | null;
}) {
  const response = await fetch("/api/mobile-bg/search-results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      method,
      fields,
      sourceListingId,
      sourceMobileId,
    }),
  });
  return parseJsonResponse<MobileBgSearchResultsResponse>(
    response,
    "Failed to load mobile.bg results",
  );
}

export async function updateSavedSearch(id: number, fields: SearchField[]) {
  const response = await fetch(`/api/saved-searches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return parseJsonResponse<SavedSearchMutationResponse>(
    response,
    "Failed to save search",
  );
}

export async function createSavedSearch(fields: SearchField[]) {
  const response = await fetch("/api/saved-searches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return parseJsonResponse<SavedSearchMutationResponse>(
    response,
    "Failed to create saved search",
  );
}

export async function deleteSavedSearch(id: number) {
  const response = await fetch(`/api/saved-searches/${id}`, {
    method: "DELETE",
  });
  return parseJsonResponse<SavedSearchDeleteResponse>(
    response,
    "Failed to delete saved search",
  );
}
