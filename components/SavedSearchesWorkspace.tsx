"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SavedSearchDeleteDialog } from "@/components/saved-searches/SavedSearchDeleteDialog";
import { SavedSearchEditorHeader } from "@/components/saved-searches/SavedSearchEditorHeader";
import { SavedSearchFields } from "@/components/saved-searches/SavedSearchFields";
import { SavedSearchList } from "@/components/saved-searches/SavedSearchList";
import { SavedSearchResultsPanel } from "@/components/saved-searches/SavedSearchResultsPanel";
import { type SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import {
  SEARCH_ACTION,
  buildFirstSevenSearchFields,
  type SearchField,
} from "@/lib/mobile-bg/search-form-shared";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";
import type { MobileBgSearchResultsPayload } from "@/lib/mobile-bg/search-results";

interface SavedSearchDetailResponse {
  detail: {
    search: {
      id: number;
      listingId: number | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
    prefill: SearchPrefillData;
  };
}

interface SavedSearchListResponse {
  searches: SavedSearchSummary[];
}

interface SavedSearchMutationResponse
  extends SavedSearchListResponse, SavedSearchDetailResponse {}

interface MobileBgSearchResultsResponse extends MobileBgSearchResultsPayload {
  fallback_note?: string | null;
}

type SavedSearchDeleteResponse = SavedSearchListResponse;

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

    void fetch(`/api/saved-searches/${selectedId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              "Failed to load saved search",
          );
        }
        return payload as SavedSearchDetailResponse;
      })
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
    return detail.prefill.form.fields.map((field) => {
      const edited = editableFields.find(
        (candidate) => candidate.name === field.name,
      );
      return edited ?? field;
    });
  }, [detail, editableFields]);
  const makeOrModelChanged = useMemo(() => {
    if (!detail) return false;
    const originalMap = new Map(
      detail.prefill.form.fields.map((field) => [field.name, field.value]),
    );
    const currentMap = new Map(
      currentFields.map((field) => [field.name, field.value]),
    );
    return (
      (currentMap.get("marka") ?? "") !== (originalMap.get("marka") ?? "") ||
      (currentMap.get("model") ?? "") !== (originalMap.get("model") ?? "")
    );
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
      const params = new URLSearchParams();
      if (value) params.set("location", value);
      const res = await fetch(
        `/api/mobile-bg/location-options?${params.toString()}`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const nextLabel =
        typeof payload.label === "string" && payload.label
          ? payload.label
          : "Населено място";
      const nextOptions =
        Array.isArray(payload.options) && payload.options.length > 0
          ? (payload.options as Array<{ value: string; label: string }>)
          : [{ value: "", label: "всички" }];

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
    if (typeof document === "undefined") return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = SEARCH_ACTION;
    form.target = "_blank";
    form.acceptCharset = "windows-1251";

    for (const field of fields) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = field.name;
      input.value = field.value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  async function showResultsHere(fields = currentFields) {
    if (!detail) return;
    setResultsLoading(true);
    setResultsError("");

    try {
      const res = await fetch("/api/mobile-bg/search-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: detail.prefill.form.action,
          method: detail.prefill.form.method,
          fields,
          sourceListingId: listing?.id ?? null,
          sourceMobileId: listing?.mobile_id ?? null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            "Failed to load mobile.bg results",
        );
      }
      setResults(payload as MobileBgSearchResultsResponse);
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
      const res = await fetch(`/api/saved-searches/${detail.search.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: currentFields }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error || "Failed to save search",
        );
      }

      const data = payload as SavedSearchMutationResponse;
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
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: currentFields }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            "Failed to create saved search",
        );
      }

      const data = payload as SavedSearchMutationResponse;
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
      const res = await fetch(`/api/saved-searches/${detail.search.id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error ||
            "Failed to delete saved search",
        );
      }

      const data = payload as SavedSearchDeleteResponse;
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
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-400">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
            Loading saved search…
          </div>
        ) : !detail || !selectedSummary ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-500">
            Select a saved search to edit it.
          </div>
        ) : (
          <>
            <SavedSearchDeleteDialog
              open={deleteDialogOpen}
              busy={deleteBusy}
              onOpenChange={setDeleteDialogOpen}
              onCancel={() => setDeleteDialogOpen(false)}
              onConfirm={() => void deleteCurrent()}
            />
            <div className="rounded-lg border border-gray-700 bg-gray-900/70">
              <SavedSearchEditorHeader
                listing={listing}
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
              />
              {detail.prefill.omitted.length > 0 && (
                <div className="px-4 pt-3 text-xs text-amber-300/80">
                  {detail.prefill.omitted.join(" ")}
                </div>
              )}
              <SavedSearchFields
                fields={editableFields}
                prefillOptions={detail.prefill.options}
                subLocationLabel={subLocationLabel}
                subLocationOptions={subLocationOptions}
                locationLoading={locationLoading}
                openAutocomplete={openAutocomplete}
                getFieldValue={getFieldValue}
                onClear={clearField}
                onNudge={nudgeField}
                onOpenAutocompleteChange={setOpenAutocomplete}
                onUpdateField={updateField}
                onUpdateLocation={updateLocation}
                onUpdateMake={updateMake}
              />
            </div>

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
