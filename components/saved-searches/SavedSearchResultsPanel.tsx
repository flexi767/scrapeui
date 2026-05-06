"use client";

import { Copy, Loader2, X } from "lucide-react";
import { MobileBgSearchResultsTable } from "@/components/MobileBgSearchResultsTable";
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
          <div className="mx-auto mt-4 max-w-2xl rounded-md border border-cyan-700/50 bg-cyan-950/30 p-3 text-left text-xs leading-5 text-cyan-100/85">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-cyan-100">
                Parser bookmarklet
              </div>
              <div className="flex items-center gap-2">
                {browserImportTimedOut && onReopenBrowserSearch ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-amber-600/60 bg-amber-900/50 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-800"
                    onClick={onReopenBrowserSearch}
                  >
                    Open again
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-cyan-600/60 bg-cyan-900/60 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-800"
                  onClick={() => void navigator.clipboard?.writeText(bookmarkletHref)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                {onCancelBrowserImport ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                    onClick={onCancelBrowserImport}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
            <div className="mt-1 text-cyan-100/75">
              Save this once as a bookmark URL, then run that bookmark on any mobile.bg results page opened from this button.
            </div>
            <textarea
              readOnly
              value={bookmarkletHref}
              className="mt-2 h-20 w-full resize-none rounded border border-cyan-800/70 bg-slate-950/70 p-2 font-mono text-[11px] leading-4 text-cyan-50 outline-none"
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (!results) {
    if (!installBookmarkletHref) return null;
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-sm text-gray-300">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium text-white">Browser parser bookmarklet</div>
            <div className="mt-1 text-xs text-gray-400">
              Install once, then use it after opening browser searches.
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-cyan-700/60 bg-cyan-950/70 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900"
            onClick={() => void navigator.clipboard?.writeText(installBookmarkletHref)}
          >
            <Copy className="h-3.5 w-3.5" />
            Copy bookmarklet
          </button>
        </div>
      </div>
    );
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
