"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Plus,
  Save,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MobileBgSearchResultsTable } from "@/components/MobileBgSearchResultsTable";
import { type SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import {
  SEARCH_ACTION,
  buildFirstSevenSearchFields,
  type SearchField,
} from "@/lib/mobile-bg/search-form-shared";
import {
  buildImageList,
  formatMileage,
  formatPrice,
  getPreferredListingThumbUrl,
  parseJson,
  type ImageMeta,
} from "@/lib/utils";
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

interface AutocompleteOption {
  value: string;
  count?: number | null;
}

const HIDDEN_FIELD_NAMES = new Set([
  "topmenu",
  "rub",
  "act",
  "rub_pub_save",
  "pubtype",
  "f20",
  "f9",
]);
const ENGINE_OPTIONS = [
  "",
  "Бензинов",
  "Дизелов",
  "Електрически",
  "Хибриден",
  "Plug-in хибрид",
  "Газ",
  "Водород",
];
const TRANSMISSION_OPTIONS = ["", "Ръчна", "Автоматична", "Полуавтоматична"];
const CATEGORY_OPTIONS = [
  "",
  "Ван",
  "Джип",
  "Кабрио",
  "Комби",
  "Купе",
  "Миниван",
  "Пикап",
  "Седан",
  "Стреч лимузина",
  "Хечбек",
];
const STEPPER_FIELDS = new Set(["f10", "f11", "f25", "f26"]);
const CLEARABLE_FIELDS = new Set(["f25", "f26", "f7", "f8", "f15"]);
function normalizeAutocompleteValue(value: string) {
  return value.trim().toLowerCase();
}

function sortMakeOptions(options: AutocompleteOption[]) {
  return [...options].sort((a, b) => {
    const aHigh = (a.count ?? 0) > 10000 ? 1 : 0;
    const bHigh = (b.count ?? 0) > 10000 ? 1 : 0;
    if (aHigh !== bHigh) return bHigh - aHigh;
    if (aHigh && bHigh && (a.count ?? 0) !== (b.count ?? 0))
      return (b.count ?? 0) - (a.count ?? 0);
    return a.value.localeCompare(b.value, "bg");
  });
}

function filterAutocompleteOptions(
  options: AutocompleteOption[],
  query: string,
  {
    hideLowCountOnEmpty = false,
  }: {
    hideLowCountOnEmpty?: boolean;
  } = {},
) {
  const normalizedQuery = normalizeAutocompleteValue(query);
  const visibleBase =
    !normalizedQuery && hideLowCountOnEmpty
      ? options.filter((option) => (option.count ?? 0) >= 5)
      : options;

  const filtered = normalizedQuery
    ? visibleBase.filter((option) =>
        normalizeAutocompleteValue(option.value).includes(normalizedQuery),
      )
    : visibleBase;

  return filtered;
}

function getSelectedOptionCount(
  options: AutocompleteOption[],
  value: string,
): number | null {
  const normalizedValue = normalizeAutocompleteValue(value);
  if (!normalizedValue) return null;
  const match = options.find(
    (option) => normalizeAutocompleteValue(option.value) === normalizedValue,
  );
  return match?.count ?? null;
}

function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  hideLowCountOnEmpty = false,
  open,
  focusWhenOpen = false,
  trailingText,
  onArrowLeft,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyLabel: string;
  hideLowCountOnEmpty?: boolean;
  open: boolean;
  focusWhenOpen?: boolean;
  trailingText?: string | null;
  onArrowLeft?: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldSelectAllOnFocusRef = useRef(false);
  // Keep a ref to the latest `open` value so the blur timeout reads current
  // state rather than a stale closure (avoids closing a sibling dropdown that
  // the parent opened after this input's onBlur was scheduled).
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !focusWhenOpen) return;
    window.requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, [focusWhenOpen, open]);

  const visibleOptions = useMemo(
    () =>
      filterAutocompleteOptions(options, isTyping ? value : "", {
        hideLowCountOnEmpty,
      }),
    [hideLowCountOnEmpty, isTyping, options, value],
  );

  function selectOption(option: AutocompleteOption) {
    onChange(option.value);
    setIsTyping(false);
    onOpenChange(false);
    inputRef.current?.blur();
  }

  const selectedIndex =
    visibleOptions.length > 0
      ? Math.min(highlightedIndex, visibleOptions.length - 1)
      : 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" && onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) onOpenChange(true);
            if (visibleOptions.length > 0) {
              setHighlightedIndex((current) =>
                current >= visibleOptions.length - 1 ? 0 : current + 1,
              );
            }
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) onOpenChange(true);
            if (visibleOptions.length > 0) {
              setHighlightedIndex((current) =>
                current <= 0 ? visibleOptions.length - 1 : current - 1,
              );
            }
            return;
          }

          if (event.key === "Escape" && open) {
            event.preventDefault();
            onOpenChange(false);
            return;
          }

          if (event.key !== "Enter") return;
          if (!open || visibleOptions.length === 0) return;
          event.preventDefault();
          selectOption(visibleOptions[selectedIndex] ?? visibleOptions[0]);
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsTyping(true);
          setHighlightedIndex(0);
          shouldSelectAllOnFocusRef.current = false;
          onOpenChange(true);
        }}
        onFocus={() => {
          setIsTyping(false);
          setHighlightedIndex(0);
          shouldSelectAllOnFocusRef.current = true;
          onOpenChange(true);
          window.requestAnimationFrame(() => {
            if (
              shouldSelectAllOnFocusRef.current &&
              inputRef.current &&
              document.activeElement === inputRef.current
            ) {
              inputRef.current.select();
            }
          });
        }}
        onBlur={() => {
          shouldSelectAllOnFocusRef.current = false;
          // Only close if we're still the active dropdown by the time the
          // timeout fires — the parent may have opened a sibling (e.g. model
          // opens after make is selected) before the 120 ms elapses.
          window.setTimeout(() => {
            if (openRef.current) onOpenChange(false);
          }, 120);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 pr-14 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
      />
      {trailingText ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          {trailingText}
        </div>
      ) : null}
      {open && (
        <div className="saved-search-autocomplete-scroll absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-scroll overscroll-contain rounded-md border border-gray-700 bg-gray-900 shadow-xl [scrollbar-gutter:stable]">
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">{emptyLabel}</div>
          ) : (
            visibleOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOption(option);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-200 ${
                  selectedIndex === index ? "bg-gray-800" : "hover:bg-gray-800"
                }`}
              >
                <span>{option.value}</span>
                {option.count != null && (
                  <span className="text-xs text-gray-500">
                    {option.count.toLocaleString("en-US")}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatYearRange(search: SavedSearchSummary) {
  if (search.yearFrom && search.yearTo)
    return `${search.yearFrom} - ${search.yearTo}`;
  if (search.yearFrom) return `from ${search.yearFrom}`;
  if (search.yearTo) return `to ${search.yearTo}`;
  if (search.regYear) return search.regYear;
  return "—";
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
  const hasLinkedListing = Boolean(listing);
  const listingLabel =
    listing && [listing.make, listing.model].filter(Boolean).join(" ")
      ? [listing.make, listing.model].filter(Boolean).join(" ")
      : "";
  const imageMeta = parseJson<ImageMeta | null>(listing?.imageMeta, null);
  const thumbKeys = parseJson<string[]>(listing?.thumbKeys ?? null, []);
  const fullKeys = parseJson<string[]>(listing?.fullKeys ?? null, []);
  const images = listing?.mobile_id
    ? buildImageList(
        listing.mobile_id,
        fullKeys.length ? fullKeys : thumbKeys,
        thumbKeys,
        imageMeta,
        listing.imagesDownloaded === 1,
      )
    : [];
  const thumbSrc = listing?.mobile_id
    ? getPreferredListingThumbUrl(
        listing.mobile_id,
        images[0]?.thumb,
        listing.thumbSaved,
      )
    : null;

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
      <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
        <div className="border-b border-gray-700 px-4 py-3">
          <div className="text-sm font-medium text-gray-200">
            Saved searches
          </div>
          <div className="text-xs text-gray-500">{searches.length} total</div>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          {searches.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">
              No saved searches yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {searches.map((search) => {
                const active = search.id === selectedId;
                return (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => setSelectedId(search.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      active ? "bg-gray-800/80" : "hover:bg-gray-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {[search.make, search.model]
                            .filter(Boolean)
                            .join(" ") ||
                            search.title ||
                            "—"}
                        </div>
                        <div className="truncate text-xs text-gray-400">
                          Year range: {formatYearRange(search)}
                        </div>
                        {search.mobileId ? (
                          <div className="mt-1 truncate text-[11px] text-gray-500">
                            Entry: {search.title || "—"} • {search.mobileId}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-[11px] text-gray-500">
                        #{search.id}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

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
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogContent className="border border-gray-700 bg-gray-900 text-gray-100">
                <DialogHeader>
                  <DialogTitle>Delete saved search?</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    This will permanently remove the saved search.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 bg-transparent text-gray-200 hover:bg-gray-800 hover:text-white"
                    onClick={() => setDeleteDialogOpen(false)}
                    disabled={deleteBusy}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-700 bg-red-950/80 text-red-200 hover:bg-red-900 hover:text-white"
                    onClick={() => void deleteCurrent()}
                    disabled={deleteBusy}
                  >
                    {deleteBusy ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <div className="rounded-lg border border-gray-700 bg-gray-900/70">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
                {hasLinkedListing ? (
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      {listing && listing.mobile_id && thumbSrc ? (
                        <div className="relative inline-block w-24 shrink-0">
                          <a
                            href={`/listings/${listing.mobile_id}`}
                            className="peer block"
                          >
                            <ImageWithFallback
                              src={thumbSrc}
                              alt={
                                `${listing.make ?? "Listing"} ${listing.model ?? ""}`.trim() ||
                                "Listing image"
                              }
                              className="w-24 rounded object-contain"
                              style={{ aspectRatio: "4/3" }}
                              fallbackClassName="w-24 rounded bg-gray-800 text-gray-400"
                              fallbackLabel="Missing"
                            />
                          </a>
                          <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-72 peer-hover:block">
                            <ImageWithFallback
                              src={thumbSrc}
                              alt={
                                `${listing.make ?? "Listing"} ${listing.model ?? ""}`.trim() ||
                                "Listing image preview"
                              }
                              className="w-full rounded shadow-xl"
                              fallbackClassName="w-full rounded bg-gray-800 text-gray-400 shadow-xl"
                              fallbackLabel="Missing"
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="min-w-0">
                        {listingLabel ? (
                          <div className="text-sm font-medium text-white">
                            {listingLabel}
                          </div>
                        ) : null}
                        {listing ? (
                          <>
                            <a
                              href={
                                listing.mobile_id
                                  ? `/listings/${listing.mobile_id}`
                                  : undefined
                              }
                              className="mt-1 block text-sm text-gray-300 hover:text-white"
                            >
                              {listing.title || "—"}
                            </a>
                            <div className="mt-1 text-xs text-gray-500">
                              {formatPrice(listing.currentPrice)}
                              {listing.power != null
                                ? ` • ${listing.power.toLocaleString("en-US")} PS`
                                : ""}{" "}
                              • {listing.fuel || "—"} •{" "}
                              {formatMileage(listing.mileage)}
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-gray-200">
                    Search fields
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
                    onClick={() =>
                      void showResultsHere(
                        buildFirstSevenSearchFields(currentFields),
                      )
                    }
                    disabled={resultsLoading}
                  >
                    <SearchIcon className="mr-1 h-4 w-4" />
                    First 8
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
                    onClick={() => void showResultsHere()}
                    disabled={resultsLoading}
                  >
                    {resultsLoading ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <SearchIcon className="mr-1 h-4 w-4" />
                    )}
                    All
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
                    onClick={() => openInMobileBg()}
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
                    onClick={() => void activateSaveAdMode()}
                    disabled={resultsLoading}
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
                      onClick={() => void saveCurrent()}
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
                    onClick={() => void saveAsNew()}
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
                    onClick={() => setDeleteDialogOpen(true)}
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
              {detail.prefill.omitted.length > 0 && (
                <div className="px-4 pt-3 text-xs text-amber-300/80">
                  {detail.prefill.omitted.join(" ")}
                </div>
              )}
              <div className="grid gap-2 p-4 md:grid-cols-2">
                {editableFields
                  .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name))
                  .map((field) => {
                    const selectedMake = getFieldValue("marka");
                    const matchedMakeKey =
                      Object.keys(detail.prefill.options.modelsByMake).find(
                        (make) =>
                          normalizeAutocompleteValue(make) ===
                          normalizeAutocompleteValue(selectedMake),
                      ) ?? selectedMake;
                    const modelOptions = (
                      detail.prefill.options.modelsByMake[matchedMakeKey] ?? []
                    ).map((option) => ({
                      value: option.value,
                      count: option.count,
                    }));
                    const makeOptions = sortMakeOptions(
                      detail.prefill.options.makes.map((option) => ({
                        value: option.value,
                        count: option.count,
                      })),
                    );
                    const selectedMakeCount =
                      field.name === "marka"
                        ? getSelectedOptionCount(makeOptions, field.value)
                        : null;
                    const selectedModelCount =
                      field.name === "model"
                        ? getSelectedOptionCount(modelOptions, field.value)
                        : null;
                    const selectedReferenceCount =
                      selectedMakeCount ?? selectedModelCount;

                    return (
                      <div
                        key={field.name}
                        className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center gap-3 rounded border border-gray-700 bg-gray-800/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm text-gray-100">
                            {field.name === "f18"
                              ? subLocationLabel
                              : field.label}
                          </div>
                          <div className="text-xs uppercase tracking-wide text-gray-500">
                            {field.name}
                          </div>
                        </div>
                        <div className="min-w-0">
                          {field.name === "marka" ? (
                            <>
                              <AutocompleteInput
                                value={field.value}
                                onChange={updateMake}
                                options={makeOptions}
                                placeholder="Type make"
                                emptyLabel="No make matches"
                                hideLowCountOnEmpty
                                open={openAutocomplete === "marka"}
                                focusWhenOpen
                                trailingText={
                                  selectedReferenceCount != null
                                    ? selectedReferenceCount.toLocaleString(
                                        "en-US",
                                      )
                                    : null
                                }
                                onOpenChange={(open) => {
                                  if (open) {
                                    setOpenAutocomplete("marka");
                                    return;
                                  }
                                  setOpenAutocomplete((current) =>
                                    current === "marka" ? null : current,
                                  );
                                }}
                              />
                            </>
                          ) : field.name === "model" ? (
                            <>
                              <AutocompleteInput
                                value={field.value}
                                onChange={(value) =>
                                  updateField(field.name, value)
                                }
                                options={modelOptions}
                                placeholder="Type model"
                                emptyLabel="No model matches"
                                focusWhenOpen
                                open={openAutocomplete === "model"}
                                onArrowLeft={() =>
                                  setOpenAutocomplete("marka")
                                }
                                trailingText={
                                  selectedReferenceCount != null
                                    ? selectedReferenceCount.toLocaleString(
                                        "en-US",
                                      )
                                    : null
                                }
                                onOpenChange={(open) => {
                                  if (open) {
                                    setOpenAutocomplete("model");
                                    return;
                                  }
                                  setOpenAutocomplete((current) =>
                                    current === "model" ? null : current,
                                  );
                                }}
                              />
                            </>
                          ) : field.name === "f12" ? (
                            <select
                              value={field.value}
                              onChange={(event) =>
                                updateField(field.name, event.target.value)
                              }
                              className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                            >
                              {ENGINE_OPTIONS.map((option) => (
                                <option
                                  key={option || "engine-all"}
                                  value={option}
                                >
                                  {option || "Всички типове"}
                                </option>
                              ))}
                            </select>
                          ) : field.name === "f13" ? (
                            <select
                              value={field.value}
                              onChange={(event) =>
                                updateField(field.name, event.target.value)
                              }
                              className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                            >
                              {TRANSMISSION_OPTIONS.map((option) => (
                                <option
                                  key={option || "trans-all"}
                                  value={option}
                                >
                                  {option || "Без значение"}
                                </option>
                              ))}
                            </select>
                          ) : field.name === "f14" ? (
                            <select
                              value={field.value}
                              onChange={(event) =>
                                updateField(field.name, event.target.value)
                              }
                              className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                            >
                              {CATEGORY_OPTIONS.map((option) => (
                                <option
                                  key={option || "cat-all"}
                                  value={option}
                                >
                                  {option || "всички категории"}
                                </option>
                              ))}
                            </select>
                          ) : field.name === "f17" ? (
                            <select
                              value={field.value}
                              onChange={(event) =>
                                void updateLocation(event.target.value)
                              }
                              className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                            >
                              {detail.prefill.options.locations.map(
                                (option) => (
                                  <option
                                    key={`${option.value || "loc-all"}-${option.label}`}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </option>
                                ),
                              )}
                            </select>
                          ) : field.name === "f18" ? (
                            <div className="relative">
                              <select
                                value={field.value}
                                onChange={(event) =>
                                  updateField(field.name, event.target.value)
                                }
                                disabled={locationLoading}
                                className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 pr-10 text-sm text-gray-950 focus:border-blue-500 focus:outline-none disabled:cursor-wait"
                              >
                                <option value="">всички</option>
                                {subLocationOptions
                                  .filter((option) => option.value !== "")
                                  .map((option) => (
                                    <option
                                      key={`${option.value}-${option.label}`}
                                      value={option.value}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                              </select>
                              {locationLoading && (
                                <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <input
                                value={field.value}
                                onChange={(event) =>
                                  updateField(field.name, event.target.value)
                                }
                                className="min-w-0 flex-1 rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                              />
                              {STEPPER_FIELDS.has(field.name) && (
                                <>
                                  <button
                                    type="button"
                                    className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                                    onClick={() => nudgeField(field.name, -1)}
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                                    onClick={() => nudgeField(field.name, 1)}
                                  >
                                    +1
                                  </button>
                                </>
                              )}
                              {CLEARABLE_FIELDS.has(field.name) &&
                                field.value && (
                                  <button
                                    type="button"
                                    className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                                    onClick={() => clearField(field.name)}
                                  >
                                    Clear
                                  </button>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {resultsError && (
              <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {resultsError}
              </div>
            )}

            {resultsLoading && (
              <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-10 text-center text-sm text-gray-400">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                Loading mobile.bg results…
              </div>
            )}

            {results && !resultsLoading && (
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
            )}
          </>
        )}
      </section>
    </div>
  );
}
