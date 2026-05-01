import type { MobileBgSearchResultsPayload } from '@/lib/mobile-bg/search-results';

export interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived' | 'saved';
}

export interface SearchPrefillResponse {
  listing: {
    id: number;
    mobile_id: string | null;
    title: string | null;
    make: string | null;
    model: string | null;
    currentPrice: number | null;
  };
  form: {
    action: string;
    method: 'POST';
    fields: SearchField[];
    visibleFields: SearchField[];
  };
  reference: {
    makeCount: number | null;
    modelCount: number | null;
  };
  options: {
    makes: Array<{ value: string; count: number | null }>;
    modelsByMake: Record<string, Array<{ value: string; count: number | null }>>;
    locations: Array<{ value: string; label: string }>;
    subLocations: {
      label: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  omitted: string[];
  savedSearch: {
    enabled: boolean;
    updatedAt: string | null;
  };
}

export interface MobileBgSearchResultsResponse extends MobileBgSearchResultsPayload {
  fallback_note?: string | null;
}

export type PendingAction = 'open' | 'show-first-7' | null;
