"use client";

import { useCallback, useState } from "react";
import {
  fetchMobileBgSearchResults,
  type MobileBgSearchResultsResponse,
  type SavedSearchDetailResponse,
} from "@/components/saved-searches/api";
import {
  persistMobileBgBrowserResults,
} from "@/components/saved-searches/mobile-bg-results-state";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import { errorMessage } from "@/lib/utils";

type SavedSearchDetail = SavedSearchDetailResponse["detail"];

export function useSavedSearchResults({
  detail,
  listing,
  currentFields,
}: {
  detail: SavedSearchDetail | null;
  listing: SearchPrefillData["listing"];
  currentFields: SearchField[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<MobileBgSearchResultsResponse | null>(
    null,
  );
  const [saveAdMode, setSaveAdMode] = useState(false);

  const reset = useCallback(() => {
    setResults(null);
    setError("");
    setSaveAdMode(false);
  }, []);

  const showHere = useCallback(
    async (fields = currentFields) => {
      if (!detail) return;
      setLoading(true);
      setError("");

      try {
        const payload = await fetchMobileBgSearchResults({
          action: detail.prefill.form.action,
          method: detail.prefill.form.method,
          fields,
          sourceListingId: listing?.id ?? null,
          sourceMobileId: listing?.mobile_id ?? null,
        });
        setResults(payload);
        persistMobileBgBrowserResults(detail.search.id, payload);
      } catch (error) {
        setError(errorMessage(error, "Failed to load mobile.bg results"));
        setResults(null);
        persistMobileBgBrowserResults(detail.search.id, null);
      } finally {
        setLoading(false);
      }
    },
    [currentFields, detail, listing?.id, listing?.mobile_id],
  );

  const activateSaveAdMode = useCallback(
    async (browserResultsLoading: boolean) => {
      if (saveAdMode) {
        setSaveAdMode(false);
        return;
      }

      setSaveAdMode(true);
      if (!results && !loading && !browserResultsLoading) {
        await showHere();
      }
    },
    [loading, results, saveAdMode, showHere],
  );

  return {
    loading,
    error,
    results,
    saveAdMode,
    reset,
    setResults,
    setError,
    showHere,
    activateSaveAdMode,
  };
}
