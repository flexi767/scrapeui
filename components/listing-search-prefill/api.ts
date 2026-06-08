import { apiRequest } from '@/lib/utils';
import type { SearchField, SearchPrefillResponse, MobileBgSearchResultsResponse } from './types';

export async function loadSearchPrefill(listingId: number) {
  return apiRequest<SearchPrefillResponse>(`/api/listings/search-prefill/${listingId}`, 'Failed to load search fields');
}

export async function saveSearchProfileFields(listingId: number, fields: SearchField[]) {
  await apiRequest<unknown>(`/api/listing-search-profiles/${listingId}`, 'Failed to save search values', {
    method: 'POST',
    json: { fields },
  });
}

export async function resetSearchProfileFields(listingId: number) {
  await apiRequest<unknown>(`/api/listing-search-profiles/${listingId}`, 'Failed to reset saved search values', {
    method: 'DELETE',
  });
}

export async function loadLocationOptions(location: string) {
  const params = new URLSearchParams();
  if (location) params.set('location', location);
  return apiRequest<{
    label?: string;
    options?: Array<{ value: string; label: string }>;
  }>(`/api/mobile-bg/location-options?${params.toString()}`, 'Failed to load location options');
}

export async function loadMobileBgSearchResults({
  action,
  method,
  fields,
  sourceListingId,
  sourceMobileId,
}: {
  action: string;
  method: 'POST';
  fields: SearchField[];
  sourceListingId: number;
  sourceMobileId: string | null;
}) {
  return apiRequest<MobileBgSearchResultsResponse>('/api/mobile-bg/search-results', 'Failed to load mobile.bg results', {
    method: 'POST',
    json: {
      action,
      method,
      fields,
      sourceListingId,
      sourceMobileId,
    },
  });
}
