"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SavedSearchDeleteDialog } from "@/components/saved-searches/SavedSearchDeleteDialog";
import { SavedSearchEditorPanel } from "@/components/saved-searches/SavedSearchEditorPanel";
import { SavedSearchList } from "@/components/saved-searches/SavedSearchList";
import { SavedSearchResultsPanel } from "@/components/saved-searches/SavedSearchResultsPanel";
import {
  SavedSearchEmptyState,
  SavedSearchLoadingState,
} from "@/components/saved-searches/SavedSearchWorkspaceStates";
import {
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedSearchDetail,
  type SavedSearchDetailResponse,
  updateSavedSearch,
} from "@/components/saved-searches/api";
import { submitMobileBgSearch } from "@/components/saved-searches/helpers";
import { useMobileBgBrowserResults } from "@/components/saved-searches/useMobileBgBrowserResults";
import { useSavedSearchFormState } from "@/components/saved-searches/useSavedSearchFormState";
import { useSavedSearchResults } from "@/components/saved-searches/useSavedSearchResults";
import {
  buildFirstSevenSearchFields,
} from "@/lib/mobile-bg/search-form-shared";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";

export default function SavedSearchesWorkspace({
  initialSearches,
  initialDetail,
}: {
  initialSearches: SavedSearchSummary[];
  initialDetail: SavedSearchDetailResponse["detail"] | null;
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialDetail?.search.id ?? initialSearches[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<
    SavedSearchDetailResponse["detail"] | null
  >(initialDetail);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const searchForm = useSavedSearchFormState(initialDetail);
  const getCurrentSearchFields = searchForm.getCurrentFields;
  const getMakeOrModelChanged = searchForm.getMakeOrModelChanged;
  const loadSearchFormFromDetail = searchForm.loadFromDetail;
  const resetSearchForm = searchForm.reset;

  const listing = detail?.prefill.listing ?? null;
  const selectedSummary = useMemo(
    () => searches.find((entry) => entry.id === selectedId) ?? null,
    [searches, selectedId],
  );
  const currentFields = useMemo(() => {
    return getCurrentSearchFields(detail);
  }, [detail, getCurrentSearchFields]);
  const makeOrModelChanged = useMemo(() => {
    return getMakeOrModelChanged(detail);
  }, [detail, getMakeOrModelChanged]);
  const searchResults = useSavedSearchResults({
    detail,
    listing,
    currentFields,
  });
  const browserResults = useMobileBgBrowserResults({
    searchId: detail?.search.id ?? null,
    currentFields,
    results: searchResults.results,
    setResults: searchResults.setResults,
    setResultsError: searchResults.setError,
  });
  const resetBrowserResults = browserResults.reset;
  const resetSearchResults = searchResults.reset;

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      resetSearchForm();
      resetSearchResults();
      resetBrowserResults();
      return;
    }

    if (detail?.search.id === selectedId) return;

    let cancelled = false;
    setLoadingDetail(true);
    resetSearchResults();
    resetBrowserResults();

    void fetchSavedSearchDetail(selectedId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.detail);
        loadSearchFormFromDetail(payload.detail);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load saved search",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    loadSearchFormFromDetail,
    resetBrowserResults,
    resetSearchForm,
    resetSearchResults,
    selectedId,
    detail,
  ]);

  function syncFromDetail(nextDetail: SavedSearchDetailResponse["detail"]) {
    setDetail(nextDetail);
    loadSearchFormFromDetail(nextDetail);
  }

  function openInMobileBg(fields = currentFields) {
    submitMobileBgSearch(fields);
  }

  async function saveCurrent() {
    if (!detail) return;
    setSaveBusy(true);
    try {
      const data = await updateSavedSearch(detail.search.id, currentFields);
      setSearches(data.searches);
      syncFromDetail(data.detail);
      toast.success("Saved search updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save search",
      );
    } finally {
      setSaveBusy(false);
    }
  }

  async function saveAsNew() {
    if (!detail) return;
    setCloneBusy(true);
    try {
      const data = await createSavedSearch(currentFields);
      setSearches(data.searches);
      syncFromDetail(data.detail);
      setSelectedId(data.detail.search.id);
      toast.success("Created a new saved search");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create saved search",
      );
    } finally {
      setCloneBusy(false);
    }
  }

  async function deleteCurrent() {
    if (!detail) return;

    setDeleteBusy(true);
    try {
      const data = await deleteSavedSearch(detail.search.id);
      const nextSearches = data.searches;
      setSearches(nextSearches);

      const nextSelectedId =
        nextSearches.find((search) => search.id !== detail.search.id)?.id ??
        null;
      setSelectedId(nextSelectedId);
      if (nextSelectedId == null) {
        setDetail(null);
        resetSearchForm();
        resetSearchResults();
      }

      setDeleteDialogOpen(false);
      toast.success("Saved search deleted");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete saved search",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)]">
      <SavedSearchList
        searches={searches}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <section className="space-y-4">
        {loadingDetail ? (
          <SavedSearchLoadingState />
        ) : !detail || !selectedSummary ? (
          <SavedSearchEmptyState />
        ) : (
          <>
            <SavedSearchDeleteDialog
              open={deleteDialogOpen}
              busy={deleteBusy}
              onOpenChange={setDeleteDialogOpen}
              onCancel={() => setDeleteDialogOpen(false)}
              onConfirm={() => void deleteCurrent()}
            />
            <SavedSearchEditorPanel
              detail={detail}
              fields={searchForm.editableFields}
              subLocationLabel={searchForm.subLocationLabel}
              subLocationOptions={searchForm.subLocationOptions}
              locationLoading={searchForm.locationLoading}
              openAutocomplete={searchForm.openAutocomplete}
              resultsLoading={searchResults.loading}
              browserResultsLoading={browserResults.loading}
              saveAdMode={searchResults.saveAdMode}
              makeOrModelChanged={makeOrModelChanged}
              saveBusy={saveBusy}
              cloneBusy={cloneBusy}
              deleteBusy={deleteBusy}
              onShowFirst={() =>
                void searchResults.showHere(
                  buildFirstSevenSearchFields(currentFields),
                )
              }
              onShowAll={() => void searchResults.showHere()}
              onSearchInBrowser={() => browserResults.showInBrowser()}
              onOpenMobileBg={() => openInMobileBg()}
              onSaveAd={() =>
                void searchResults.activateSaveAdMode(browserResults.loading)
              }
              onSave={() => void saveCurrent()}
              onSaveAsNew={() => void saveAsNew()}
              onDelete={() => setDeleteDialogOpen(true)}
              getFieldValue={searchForm.getFieldValue}
              onClear={searchForm.clearField}
              onNudge={searchForm.nudgeField}
              onOpenAutocompleteChange={searchForm.setOpenAutocomplete}
              onUpdateField={searchForm.updateField}
              onUpdateLocation={searchForm.updateLocation}
              onUpdateMake={(value) => searchForm.updateMake(detail, value)}
            />

            <SavedSearchResultsPanel
              error={searchResults.error}
              loading={searchResults.loading || browserResults.loading}
              loadingNote={browserResults.loading ? browserResults.notice : ""}
              bookmarkletHref={
                browserResults.loading ? browserResults.bookmarklet : ""
              }
              installBookmarkletHref={
                !browserResults.loading ? browserResults.installBookmarklet : ""
              }
              browserImportTimedOut={browserResults.timedOut}
              onCancelBrowserImport={
                browserResults.loading ? browserResults.cancelImport : undefined
              }
              onReopenBrowserSearch={
                browserResults.loading ? browserResults.reopenSearch : undefined
              }
              results={searchResults.results}
              listing={listing}
              saveAdMode={searchResults.saveAdMode}
            />
          </>
        )}
      </section>
    </div>
  );
}
