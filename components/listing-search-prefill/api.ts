import type { SearchField, SearchPrefillResponse, MobileBgSearchResultsResponse } from './types';

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

export async function loadSearchPrefill(listingId: number) {
  const res = await fetch(`/api/listings/search-prefill/${listingId}`);
  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || 'Failed to load search fields');
  }

  return payload as SearchPrefillResponse;
}

export async function saveSearchProfileFields(listingId: number, fields: SearchField[]) {
  const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || 'Failed to save search values');
  }
}

export async function resetSearchProfileFields(listingId: number) {
  const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
    method: 'DELETE',
  });
  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || 'Failed to reset saved search values');
  }
}

export async function loadLocationOptions(location: string) {
  const params = new URLSearchParams();
  if (location) params.set('location', location);
  const res = await fetch(`/api/mobile-bg/location-options?${params.toString()}`);
  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || 'Failed to load location options');
  }

  return payload as {
    label?: string;
    options?: Array<{ value: string; label: string }>;
  };
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
  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error((payload as { error?: string }).error || 'Failed to load mobile.bg results');
  }

  return payload as MobileBgSearchResultsResponse;
}
