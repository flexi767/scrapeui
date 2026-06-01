import { fetchMobileBgSearchResultsHtml } from '@/lib/mobile-bg/search-results-request';
import { parseMobileBgSearchResultsPage } from '@/lib/mobile-bg/search-results-page-parser';
import type {
  MobileBgSearchFieldInput,
  MobileBgSearchResultRow,
  MobileBgSearchResultsPagePayload,
  MobileBgSearchResultsPayload,
  MobileBgSearchResultsUntilFoundPayload,
} from '@/lib/mobile-bg/search-results-types';

export type {
  MobileBgSearchFieldInput,
  MobileBgSearchResultRow,
  MobileBgSearchResultsPagePayload,
  MobileBgSearchResultsPayload,
  MobileBgSearchResultsUntilFoundPayload,
} from '@/lib/mobile-bg/search-results-types';

const RELAXED_PREVIEW_FILTER_NAMES = new Set(['f12', 'f13', 'f14']);
const RELAXED_PREVIEW_FALLBACK_NOTE =
  'No results were returned with engine, gearbox, and body type applied, so those three filters were relaxed for the in-app preview.';

async function fetchWithRelaxedPreviewFallback<T extends MobileBgSearchResultsPayload>(
  submittedFields: MobileBgSearchFieldInput[],
  fetchResults: (fields: MobileBgSearchFieldInput[]) => Promise<T>,
): Promise<T> {
  const initial = await fetchResults(submittedFields);
  if (initial.count_on_page > 0) return initial;

  const relaxedFields = submittedFields.filter((field) => !RELAXED_PREVIEW_FILTER_NAMES.has(field.name));
  if (relaxedFields.length === submittedFields.length) return initial;

  const relaxed = await fetchResults(relaxedFields);
  if (relaxed.count_on_page === 0) return initial;

  return {
    ...relaxed,
    fallback_note: RELAXED_PREVIEW_FALLBACK_NOTE,
  };
}

function containsMobileId(rows: MobileBgSearchResultRow[], mobileId: string): boolean {
  return rows.some((row) => row.mobile_id === mobileId);
}

function appendDedupedRows(
  rows: MobileBgSearchResultRow[],
  incomingRows: MobileBgSearchResultRow[],
): MobileBgSearchResultRow[] {
  const existingIds = new Set(rows.map((row) => row.mobile_id));
  return [
    ...rows,
    ...incomingRows
      .filter((row) => !existingIds.has(row.mobile_id))
      .map((row) => ({
        ...row,
        original_position: rows.length + row.original_position,
      })),
  ];
}

export async function fetchMobileBgSearchResults(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  return fetchMobileBgSearchResultsOnce(action, method, submittedFields, sourceMobileId);
}

async function fetchMobileBgSearchResultsOnce(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  const initial = await fetchMobileBgSearchResultsPage(action, method, submittedFields);

  if (
    sourceMobileId &&
    initial.has_next_page &&
    initial.next_page_url &&
    !containsMobileId(initial.rows, sourceMobileId)
  ) {
    const secondPage = await fetchMobileBgSearchResultsPage(initial.next_page_url, 'get', submittedFields);
    const rows = appendDedupedRows(initial.rows, secondPage.rows);

    return {
      ...initial,
      has_next_page: secondPage.has_next_page,
      total_pages: secondPage.total_pages ?? initial.total_pages,
      count_on_page: rows.length,
      loaded_until_page: secondPage.page,
      rows,
    };
  }

  return initial;
}

async function fetchMobileBgSearchResultsPage(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
): Promise<MobileBgSearchResultsPagePayload> {
  const { html, normalizedFields } = await fetchMobileBgSearchResultsHtml(action, method, submittedFields);
  return parseMobileBgSearchResultsPage(html, normalizedFields, submittedFields);
}

export async function fetchMobileBgSearchResultsWithFallback(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId?: string | null,
): Promise<MobileBgSearchResultsPayload> {
  return fetchWithRelaxedPreviewFallback(submittedFields, (fields) =>
    fetchMobileBgSearchResultsOnce(action, method, fields, sourceMobileId),
  );
}

async function fetchMobileBgSearchResultsUntilFoundOnce(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId: string,
): Promise<MobileBgSearchResultsUntilFoundPayload> {
  const firstPage = await fetchMobileBgSearchResultsPage(action, method, submittedFields);
  const rows = [...firstPage.rows];
  let nextPageUrl = firstPage.next_page_url;
  let hasNextPage = firstPage.has_next_page;
  let totalPages = firstPage.total_pages;
  let foundOnPage = containsMobileId(rows, sourceMobileId) ? firstPage.page : null;

  while (!foundOnPage && hasNextPage && nextPageUrl) {
    const nextPage = await fetchMobileBgSearchResultsPage(nextPageUrl, 'get', submittedFields);
    const rowsBeforeAppend = rows.length;
    rows.push(...appendDedupedRows(rows, nextPage.rows).slice(rowsBeforeAppend));
    if (containsMobileId(rows.slice(rowsBeforeAppend), sourceMobileId)) {
      foundOnPage = nextPage.page;
    }

    nextPageUrl = nextPage.next_page_url;
    hasNextPage = nextPage.has_next_page;
    totalPages = nextPage.total_pages ?? totalPages;
  }

  return {
    submitted_fields: submittedFields,
    summary_text: firstPage.summary_text,
    page: firstPage.page,
    total_pages: totalPages,
    has_next_page: hasNextPage,
    count_on_page: rows.length,
    loaded_until_page: foundOnPage ?? firstPage.page,
    rows,
    found_on_page: foundOnPage,
  };
}

export async function fetchMobileBgSearchResultsUntilFound(
  action: string,
  method: string,
  submittedFields: MobileBgSearchFieldInput[],
  sourceMobileId: string,
): Promise<MobileBgSearchResultsUntilFoundPayload> {
  return fetchWithRelaxedPreviewFallback(submittedFields, (fields) =>
    fetchMobileBgSearchResultsUntilFoundOnce(action, method, fields, sourceMobileId),
  );
}
