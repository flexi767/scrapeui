import { apiRequest } from "@/lib/utils";
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

export async function fetchSavedSearchDetail(id: number) {
  return apiRequest<SavedSearchDetailResponse>(
    `/api/saved-searches/${id}`,
    "Failed to load saved search",
  );
}

export async function fetchLocationOptions(value: string) {
  const params = new URLSearchParams();
  if (value) params.set("location", value);
  return apiRequest<LocationOptionsResponse>(
    `/api/mobile-bg/location-options?${params.toString()}`,
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
  return apiRequest<MobileBgSearchResultsResponse>("/api/mobile-bg/search-results", "Failed to load mobile.bg results", {
    method: "POST",
    json: {
      action,
      method,
      fields,
      sourceListingId,
      sourceMobileId,
    },
  });
}

export async function updateSavedSearch(id: number, fields: SearchField[]) {
  return apiRequest<SavedSearchMutationResponse>(`/api/saved-searches/${id}`, "Failed to save search", {
    method: "PATCH",
    json: { fields },
  });
}

export async function createSavedSearch(fields: SearchField[]) {
  return apiRequest<SavedSearchMutationResponse>("/api/saved-searches", "Failed to create saved search", {
    method: "POST",
    json: { fields },
  });
}

export async function deleteSavedSearch(id: number) {
  return apiRequest<SavedSearchDeleteResponse>(`/api/saved-searches/${id}`, "Failed to delete saved search", {
    method: "DELETE",
  });
}
