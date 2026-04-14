import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  deleteSavedSearchProfileByListingId,
  getSavedSearchProfileByListingId,
  upsertSavedSearchProfile,
} from "@/lib/mobile-bg/saved-searches";

export type SavedSearchField = SearchField;

export interface SavedSearchProfile {
  listingId: number;
  fields: SavedSearchField[];
  updatedAt: string | null;
}

export function getSavedSearchProfile(
  listingId: number,
): SavedSearchProfile | null {
  const record = getSavedSearchProfileByListingId(listingId);
  if (!record) return null;

  return {
    listingId,
    fields: record.fields,
    updatedAt: record.updatedAt,
  };
}

export function saveSearchProfile(listingId: number, fields: SavedSearchField[]) {
  return upsertSavedSearchProfile(listingId, fields);
}

export function deleteSearchProfile(listingId: number) {
  deleteSavedSearchProfileByListingId(listingId);
}
