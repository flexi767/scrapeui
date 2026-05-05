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
  fetchLocationOptions,
  fetchMobileBgSearchResults,
  fetchSavedSearchDetail,
  type MobileBgSearchResultsResponse,
  type SavedSearchDetailResponse,
  updateSavedSearch,
} from "@/components/saved-searches/api";
import {
  didMakeOrModelChange,
  mergeEditableFields,
  normalizeLocationOptions,
  submitMobileBgSearch,
} from "@/components/saved-searches/helpers";
import {
  buildFirstSevenSearchFields,
  type SearchField,
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
  const [editableFields, setEditableFields] = useState<SearchField[]>(
    initialDetail?.prefill.form.fields.map((field) => ({ ...field })) ?? [],
  );
  const [subLocationLabel, setSubLocationLabel] = useState(
    initialDetail?.prefill.options.subLocations.label ?? "Населено място",
  );
  const [subLocationOptions, setSubLocationOptions] = useState(
    initialDetail?.prefill.options.subLocations.options ?? [
      { value: "", label: "всички" },
    ],
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState("");
  const [results, setResults] = useState<MobileBgSearchResultsResponse | null>(
    null,
  );
  const [saveBusy, setSaveBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saveAdMode, setSaveAdMode] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [openAutocomplete, setOpenAutocomplete] = useState<
    "marka" | "model" | null
  >(null);

  const listing = detail?.prefill.listing ?? null;

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      setEditableFields([]);
      setResults(null);
      setSaveAdMode(false);
      return;
    }

    if (detail?.search.id === selectedId) return;

    let cancelled = false;
    setLoadingDetail(true);
    setResults(null);
    setResultsError("");
    setSaveAdMode(false);

    void fetchSavedSearchDetail(selectedId)
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.detail);
        setEditableFields(
          payload.detail.prefill.form.fields.map((field) => ({ ...field })),
        );
        setSubLocationLabel(payload.detail.prefill.options.subLocations.label);
        setSubLocationOptions(
          payload.detail.prefill.options.subLocations.options,
        );
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
  }, [selectedId, detail]);

  const selectedSummary = useMemo(
    () => searches.find((entry) => entry.id === selectedId) ?? null,
    [searches, selectedId],
  );
  const currentFields = useMemo(() => {
    if (!detail) return [];
    return mergeEditableFields(detail.prefill.form.fields, editableFields);
  }, [detail, editableFields]);
  const makeOrModelChanged = useMemo(() => {
    if (!detail) return false;
    return didMakeOrModelChange(detail.prefill.form.fields, currentFields);
  }, [currentFields, detail]);

  function syncFromDetail(nextDetail: SavedSearchDetailResponse["detail"]) {
    setDetail(nextDetail);
    setEditableFields(
      nextDetail.prefill.form.fields.map((field) => ({ ...field })),
    );
    setSubLocationLabel(nextDetail.prefill.options.subLocations.label);
    setSubLocationOptions(nextDetail.prefill.options.subLocations.options);
  }

  function updateField(name: string, value: string) {
    setEditableFields((prev) =>
      prev.map((field) => (field.name === name ? { ...field, value } : field)),
    );
  }

  function getFieldValue(name: string) {
    return editableFields.find((field) => field.name === name)?.value ?? "";
  }

  function updateMake(value: string) {
    setOpenAutocomplete("model");
    setEditableFields((prev) => {
      const next = prev.map((field) =>
        field.name === "marka" ? { ...field, value } : field,
      );
      const validModels = detail?.prefill.options.modelsByMake[value] ?? [];
      const currentModel =
        next.find((field) => field.name === "model")?.value ?? "";
      if (
        currentModel &&
        !validModels.some((option) => option.value === currentModel)
      ) {
        return next.map((field) =>
          field.name === "model" ? { ...field, value: "" } : field,
        );
      }
      return next;
    });
  }

  async function updateLocation(value: string) {
    updateField("f17", value);
    setLocationLoading(true);
    setSubLocationLabel("Населено място");
    setSubLocationOptions([{ value: "", label: "всички" }]);
    setEditableFields((prev) =>
      prev.map((field) => {
        if (field.name === "f17") return { ...field, value };
        if (field.name === "f18")
          return {
            ...field,
            value: "",
            label: "Населено място",
            source: "default",
          };
        return field;
      }),
    );

    try {
      const payload = await fetchLocationOptions(value);
      const { label: nextLabel, options: nextOptions } =
        normalizeLocationOptions(payload);

      setSubLocationLabel(nextLabel);
      setSubLocationOptions(nextOptions);
      setEditableFields((prev) =>
        prev.map((field) =>
          field.name === "f18"
            ? { ...field, label: nextLabel, value: "" }
            : field,
        ),
      );
    } finally {
      setLocationLoading(false);
    }
  }

  function nudgeField(name: string, delta: number) {
    setEditableFields((prev) =>
      prev.map((field) => {
        if (field.name !== name) return field;
        const parsed = Number.parseInt(field.value || "0", 10);
        const base = Number.isFinite(parsed) ? parsed : 0;
        return { ...field, value: String(base + delta) };
      }),
    );
  }

  function clearField(name: string) {
    updateField(name, "");
  }

  function openInMobileBg(fields = currentFields) {
    submitMobileBgSearch(fields);
  }

  async function showResultsHere(fields = currentFields) {
    if (!detail) return;
    setResultsLoading(true);
    setResultsError("");

    try {
      const payload = await fetchMobileBgSearchResults({
        action: detail.prefill.form.action,
        method: detail.prefill.form.method,
        fields,
        sourceListingId: listing?.id ?? null,
        sourceMobileId: listing?.mobile_id ?? null,
      });
      setResults(payload);
    } catch (error) {
      setResultsError(
        error instanceof Error
          ? error.message
          : "Failed to load mobile.bg results",
      );
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }

  async function activateSaveAdMode() {
    if (saveAdMode) {
      setSaveAdMode(false);
      return;
    }

    setSaveAdMode(true);
    if (!results && !resultsLoading) {
      await showResultsHere();
    }
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
        setEditableFields([]);
        setResults(null);
        setResultsError("");
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
              fields={editableFields}
              subLocationLabel={subLocationLabel}
              subLocationOptions={subLocationOptions}
              locationLoading={locationLoading}
              openAutocomplete={openAutocomplete}
              resultsLoading={resultsLoading}
              saveAdMode={saveAdMode}
              makeOrModelChanged={makeOrModelChanged}
              saveBusy={saveBusy}
              cloneBusy={cloneBusy}
              deleteBusy={deleteBusy}
              onShowFirst={() =>
                void showResultsHere(buildFirstSevenSearchFields(currentFields))
              }
              onShowAll={() => void showResultsHere()}
              onOpenMobileBg={() => openInMobileBg()}
              onSaveAd={() => void activateSaveAdMode()}
              onSave={() => void saveCurrent()}
              onSaveAsNew={() => void saveAsNew()}
              onDelete={() => setDeleteDialogOpen(true)}
              getFieldValue={getFieldValue}
              onClear={clearField}
              onNudge={nudgeField}
              onOpenAutocompleteChange={setOpenAutocomplete}
              onUpdateField={updateField}
              onUpdateLocation={updateLocation}
              onUpdateMake={updateMake}
            />

            <SavedSearchResultsPanel
              error={resultsError}
              loading={resultsLoading}
              results={results}
              listing={listing}
              saveAdMode={saveAdMode}
            />
          </>
        )}
      </section>
    </div>
  );
}
