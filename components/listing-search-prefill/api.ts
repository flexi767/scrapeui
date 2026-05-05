import { parseApiResponse } from '@/lib/utils';
import type { SearchField, SearchPrefillResponse, MobileBgSearchResultsResponse } from './types';

export async function loadSearchPrefill(listingId: number) {
  const res = await fetch(`/api/listings/search-prefill/${listingId}`);
  return parseApiResponse<SearchPrefillResponse>(res, 'Failed to load search fields');
}

export async function saveSearchProfileFields(listingId: number, fields: SearchField[]) {
  const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  await parseApiResponse<unknown>(res, 'Failed to save search values');
}

export async function resetSearchProfileFields(listingId: number) {
  const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
    method: 'DELETE',
  });
  await parseApiResponse<unknown>(res, 'Failed to reset saved search values');
}

export async function loadLocationOptions(location: string) {
  const params = new URLSearchParams();
  if (location) params.set('location', location);
  const res = await fetch(`/api/mobile-bg/location-options?${params.toString()}`);
  return parseApiResponse<{
    label?: string;
    options?: Array<{ value: string; label: string }>;
  }>(res, 'Failed to load location options');
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
  const res = await fetch('/api/mobile-bg/search-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      method,
      fields,
      sourceListingId,
      sourceMobileId,
    }),
  });
  return parseApiResponse<MobileBgSearchResultsResponse>(res, 'Failed to load mobile.bg results');
}
