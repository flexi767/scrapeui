import { Loader2 } from "lucide-react";
import { MobileBgSearchResultsTable } from "@/components/MobileBgSearchResultsTable";
import type { MobileBgSearchResultsResponse } from "@/components/saved-searches/api";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";

export function SavedSearchResultsPanel({
  error,
  loading,
  results,
  listing,
  saveAdMode,
}: {
  error: string;
  loading: boolean;
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
      </div>
    );
  }

  if (!results) return null;

  return (
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
  );
}
