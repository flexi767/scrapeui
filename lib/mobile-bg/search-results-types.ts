import type { VatValue } from '@/lib/vat';

export interface MobileBgSearchFieldInput {
  name: string;
  value: string;
}

export interface MobileBgSearchResultRow {
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
  vat_status: VatValue | null;
  ad_status: string;
  reg_month: string | null;
  reg_year: string | null;
  body_type: string | null;
  fuel: string | null;
  mileage: number | null;
  transmission: string | null;
  power: number | null;
}

export interface MobileBgSearchResultsPayload {
  submitted_fields: MobileBgSearchFieldInput[];
  summary_text: string | null;
  page: number;
  total_pages: number | null;
  has_next_page: boolean;
  count_on_page: number;
  loaded_until_page: number;
  ignored_search_result_ids?: string[];
  rows: MobileBgSearchResultRow[];
  fallback_note?: string | null;
}

export interface MobileBgSearchResultsPagePayload extends MobileBgSearchResultsPayload {
  next_page_url: string | null;
}

export interface MobileBgSearchResultsUntilFoundPayload extends MobileBgSearchResultsPayload {
  found_on_page: number | null;
}
