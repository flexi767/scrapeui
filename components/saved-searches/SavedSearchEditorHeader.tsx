import {
  ExternalLink,
  Loader2,
  Plus,
  Save,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { SavedSearchEditorListingSummary } from "@/components/saved-searches/SavedSearchEditorListingSummary";
import { Button } from "@/components/ui/button";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";

type SavedSearchListing = SearchPrefillData["listing"];

export function SavedSearchEditorHeader({
  listing,
  resultsLoading,
  browserResultsLoading,
  saveAdMode,
  makeOrModelChanged,
  saveBusy,
  cloneBusy,
  deleteBusy,
  onShowFirst,
  onShowAll,
  onSearchInBrowser,
  onOpenMobileBg,
  onSaveAd,
  onSave,
  onSaveAsNew,
  onDelete,
}: {
  listing: SavedSearchListing;
  resultsLoading: boolean;
  browserResultsLoading: boolean;
  saveAdMode: boolean;
  makeOrModelChanged: boolean;
  saveBusy: boolean;
  cloneBusy: boolean;
  deleteBusy: boolean;
  onShowFirst: () => void;
  onShowAll: () => void;
  onSearchInBrowser: () => void;
  onOpenMobileBg: () => void;
  onSaveAd: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
      <SavedSearchEditorListingSummary listing={listing} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onShowFirst}
          disabled={resultsLoading || browserResultsLoading}
        >
          <SearchIcon className="mr-1 h-4 w-4" />
          First 7
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
          onClick={onShowAll}
          disabled={resultsLoading || browserResultsLoading}
        >
          {resultsLoading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-1 h-4 w-4" />
          )}
          Search on Server
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-cyan-700 bg-cyan-950/80 text-cyan-200 hover:bg-cyan-900 hover:text-white"
          onClick={onSearchInBrowser}
          disabled={resultsLoading || browserResultsLoading}
        >
          {browserResultsLoading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-1 h-4 w-4" />
          )}
          Open Browser Search
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onOpenMobileBg}
        >
          <ExternalLink className="mr-1 h-4 w-4" />
          Open mobile.bg
        </Button>
        <Button
          type="button"
          variant="outline"
          className={
            saveAdMode
              ? "border-emerald-600 bg-emerald-900 text-white hover:bg-emerald-800"
              : "border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
          }
          onClick={onSaveAd}
          disabled={resultsLoading || browserResultsLoading}
        >
          {resultsLoading && saveAdMode ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Save Ad
        </Button>
        {!makeOrModelChanged && (
          <Button
            type="button"
            variant="outline"
            className="border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
            onClick={onSave}
            disabled={saveBusy}
          >
            {saveBusy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="border-amber-700 bg-amber-950/80 text-amber-200 hover:bg-amber-900 hover:text-white"
          onClick={onSaveAsNew}
          disabled={cloneBusy}
        >
          {cloneBusy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Save As New
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-red-700 bg-red-950/80 text-red-200 hover:bg-red-900 hover:text-white"
          onClick={onDelete}
          disabled={deleteBusy}
        >
          {deleteBusy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-4 w-4" />
          )}
          Delete
        </Button>
      </div>
    </div>
  );
}
