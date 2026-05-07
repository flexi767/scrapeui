"use client";

import { Loader2 } from "lucide-react";
import { MobileBgSearchResultsTable } from "@/components/MobileBgSearchResultsTable";
import {
  ActiveBrowserImportCard,
  InstallBookmarkletCard,
} from "@/components/saved-searches/SavedSearchBookmarkletCards";
import type { MobileBgSearchResultsResponse } from "@/components/saved-searches/api";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";

export function SavedSearchResultsPanel({
  error,
  loading,
  loadingNote,
  bookmarkletHref,
  installBookmarkletHref,
  browserImportTimedOut,
  onCancelBrowserImport,
  onReopenBrowserSearch,
  results,
  listing,
  saveAdMode,
}: {
  error: string;
  loading: boolean;
  loadingNote?: string;
  bookmarkletHref?: string;
  installBookmarkletHref?: string;
  browserImportTimedOut?: boolean;
  onCancelBrowserImport?: () => void;
  onReopenBrowserSearch?: () => void;
  results: MobileBgSearchResultsResponse | null;
  listing: SearchPrefillData["listing"];
  saveAdMode: boolean;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-10 text-center text-sm text-gray-400">
        <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
        Loading mobile.bg results…
        {loadingNote ? (
          <div className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-cyan-100/80">
            {loadingNote}
          </div>
        ) : null}
        {bookmarkletHref ? (
          <ActiveBrowserImportCard
            bookmarkletHref={bookmarkletHref}
            browserImportTimedOut={browserImportTimedOut}
            onCancelBrowserImport={onCancelBrowserImport}
            onReopenBrowserSearch={onReopenBrowserSearch}
            />
        ) : null}
      </div>
    );
  }

  if (!results) {
    if (!installBookmarkletHref) return null;
    return <InstallBookmarkletCard installBookmarkletHref={installBookmarkletHref} />;
  }

  return (
    <div className="space-y-2">
      {results.fallback_note ? (
        <div className="rounded-lg border border-cyan-700/40 bg-cyan-950/35 px-4 py-2 text-xs text-cyan-100/85">
          {results.fallback_note}
        </div>
      ) : null}
      <MobileBgSearchResultsTable
        rows={results.rows}
        summaryText={results.summary_text}
        page={results.page}
        totalPages={results.total_pages}
        hasNextPage={results.has_next_page}
        loadedUntilPage={results.loaded_until_page}
        sourceListingId={listing?.id ?? 0}
        sourceMobileId={listing?.mobile_id ?? null}
        initialIgnoredResultIds={results.ignored_search_result_ids}
        saveAdMode={saveAdMode}
      />
    </div>
  );
}
