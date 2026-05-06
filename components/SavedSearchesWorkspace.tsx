"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  buildMobileBgBrowserSearchWindowName,
  buildMobileBgResultsBookmarklet,
  MOBILE_BG_BROWSER_RESULTS_MESSAGE,
  type MobileBgBrowserResultsMessage,
} from "@/components/saved-searches/mobile-bg-results-bookmarklet";
import {
  buildFirstSevenSearchFields,
  type SearchField,
} from "@/lib/mobile-bg/search-form-shared";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";

function getResultsStorageKey(searchId: number) {
  return `scrapeui.savedSearch.browserResults.${searchId}`;
}

function persistResults(searchId: number, payload: MobileBgSearchResultsResponse | null) {
  if (typeof window === "undefined") return;
  try {
    if (payload) {
      window.localStorage.setItem(getResultsStorageKey(searchId), JSON.stringify(payload));
    } else {
      window.localStorage.removeItem(getResultsStorageKey(searchId));
    }
  } catch {}
}

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
  const [browserResultsLoading, setBrowserResultsLoading] = useState(false);
  const [browserResultsNotice, setBrowserResultsNotice] = useState("");
  const [browserBookmarklet, setBrowserBookmarklet] = useState("");
  const [browserImportTimedOut, setBrowserImportTimedOut] = useState(false);
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
  const pendingBrowserSearchTokenRef = useRef<string | null>(null);
  const pendingBrowserSearchFieldsRef = useRef<SearchField[] | null>(null);
  const installBookmarklet = useMemo(() => buildMobileBgResultsBookmarklet(), []);

  function mergeBrowserResults(
    previous: MobileBgSearchResultsResponse | null,
    incoming: MobileBgSearchResultsResponse,
  ): MobileBgSearchResultsResponse {
    if (!previous?.rows.length) return incoming;
    const rowsById = new Map(previous.rows.map((row) => [row.mobile_id, row]));
    for (const row of incoming.rows) rowsById.set(row.mobile_id, row);
    const rows = Array.from(rowsById.values()).map((row, index) => ({
      ...row,
      original_position: index + 1,
    }));
    return {
      ...incoming,
      page: previous.page,
      total_pages: incoming.total_pages ?? previous.total_pages,
      has_next_page: incoming.has_next_page,
      count_on_page: rows.length,
      loaded_until_page: Math.max(previous.loaded_until_page ?? previous.page, incoming.loaded_until_page ?? incoming.page),
      ignored_search_result_ids: [
        ...new Set([
          ...(previous.ignored_search_result_ids ?? []),
          ...(incoming.ignored_search_result_ids ?? []),
        ]),
      ],
      rows,
    };
  }

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      setEditableFields([]);
      setResults(null);
      setBrowserResultsNotice("");
      setBrowserBookmarklet("");
      setBrowserImportTimedOut(false);
      setSaveAdMode(false);
      return;
    }

    if (detail?.search.id === selectedId) return;

    let cancelled = false;
    setLoadingDetail(true);
    setResults(null);
    setResultsError("");
    setBrowserResultsNotice("");
    setBrowserBookmarklet("");
    setBrowserImportTimedOut(false);
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

  useEffect(() => {
    if (!detail?.search.id || results || browserResultsLoading) return;
    try {
      const raw = window.localStorage.getItem(getResultsStorageKey(detail.search.id));
      if (raw) setResults(JSON.parse(raw) as MobileBgSearchResultsResponse);
    } catch {}
  }, [detail?.search.id, results, browserResultsLoading]);

  useEffect(() => {
    if (!browserResultsLoading) return;
    const timeout = window.setTimeout(() => {
      setBrowserImportTimedOut(true);
      setBrowserResultsNotice(
        "Still waiting for the bookmarklet import. You can run the bookmarklet, reopen mobile.bg, or cancel this import.",
      );
    }, 75_000);
    return () => window.clearTimeout(timeout);
  }, [browserResultsLoading]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== "https://www.mobile.bg" &&
        !event.origin.endsWith(".mobile.bg")
      ) {
        return;
      }

      const message = event.data as Partial<MobileBgBrowserResultsMessage> | null;
      if (
        !message ||
        message.type !== MOBILE_BG_BROWSER_RESULTS_MESSAGE ||
        !message.token ||
        message.token !== pendingBrowserSearchTokenRef.current ||
        !message.payload
      ) {
        return;
      }

      const incoming = message.payload as MobileBgSearchResultsResponse;
      const merged = mergeBrowserResults(results, incoming);
      setResults(merged);
      if (detail?.search.id) persistResults(detail.search.id, merged);
      setResultsError("");
      setBrowserResultsNotice("");
      setBrowserBookmarklet("");
      setBrowserImportTimedOut(false);
      setBrowserResultsLoading(false);
      toast.success(
        `Imported ${incoming.rows.length} mobile.bg results from the browser`,
      );
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [detail?.search.id, results]);

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

  function cancelBrowserImport() {
    pendingBrowserSearchTokenRef.current = null;
    pendingBrowserSearchFieldsRef.current = null;
    setBrowserResultsLoading(false);
    setBrowserResultsNotice("");
    setBrowserBookmarklet("");
    setBrowserImportTimedOut(false);
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
      persistResults(detail.search.id, payload);
    } catch (error) {
      setResultsError(
        error instanceof Error
          ? error.message
          : "Failed to load mobile.bg results",
      );
      setResults(null);
      persistResults(detail.search.id, null);
    } finally {
      setResultsLoading(false);
    }
  }

  async function showResultsInBrowser(fields = currentFields) {
    if (!detail) return;
    const token =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingBrowserSearchTokenRef.current = token;
    pendingBrowserSearchFieldsRef.current = fields;
    setBrowserResultsLoading(true);
    setBrowserImportTimedOut(false);
    setResultsError("");
    setResults(null);
    setBrowserResultsNotice(
      "Opened mobile.bg in a browser tab. Run the copied scrapeui bookmarklet on that results page to import parsed rows here.",
    );

    const browserSearchWindowName = buildMobileBgBrowserSearchWindowName({
      appOrigin: window.location.origin,
      token,
      fields,
    });
    const bookmarklet = installBookmarklet;
    setBrowserBookmarklet(bookmarklet);

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard
        .writeText(bookmarklet)
        .then(() => toast.success("Copied the mobile.bg parser bookmarklet"))
        .catch(() => {
          toast.message("Could not copy the bookmarklet automatically", {
            description:
              "Use the parser bookmarklet link shown below the search controls.",
          });
        });
    } else {
      toast.message("Use the parser bookmarklet link shown below the search controls.");
    }
    submitMobileBgSearch(
      fields,
      "scrapeui-mobile-bg-browser-search",
      browserSearchWindowName,
    );
  }

  function reopenBrowserSearch() {
    const fields = pendingBrowserSearchFieldsRef.current ?? currentFields;
    if (!fields.length) return;
    const token = pendingBrowserSearchTokenRef.current;
    if (!token) {
      void showResultsInBrowser(fields);
      return;
    }
    const browserSearchWindowName = buildMobileBgBrowserSearchWindowName({
      appOrigin: window.location.origin,
      token,
      fields,
    });
    submitMobileBgSearch(
      fields,
      "scrapeui-mobile-bg-browser-search",
      browserSearchWindowName,
    );
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
              browserResultsLoading={browserResultsLoading}
              saveAdMode={saveAdMode}
              makeOrModelChanged={makeOrModelChanged}
              saveBusy={saveBusy}
              cloneBusy={cloneBusy}
              deleteBusy={deleteBusy}
              onShowFirst={() =>
                void showResultsHere(buildFirstSevenSearchFields(currentFields))
              }
              onShowAll={() => void showResultsHere()}
              onSearchInBrowser={() => void showResultsInBrowser()}
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
              loading={resultsLoading || browserResultsLoading}
              loadingNote={browserResultsLoading ? browserResultsNotice : ""}
              bookmarkletHref={browserResultsLoading ? browserBookmarklet : ""}
              installBookmarkletHref={!browserResultsLoading ? installBookmarklet : ""}
              browserImportTimedOut={browserImportTimedOut}
              onCancelBrowserImport={
                browserResultsLoading ? cancelBrowserImport : undefined
              }
              onReopenBrowserSearch={
                browserResultsLoading ? reopenBrowserSearch : undefined
              }
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
