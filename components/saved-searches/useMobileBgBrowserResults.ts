"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MobileBgSearchResultsResponse } from "@/components/saved-searches/api";
import { submitMobileBgSearch } from "@/components/saved-searches/helpers";
import {
  buildMobileBgBrowserSearchWindowName,
  buildMobileBgResultsBookmarklet,
  mergeMobileBgBrowserResults,
  MOBILE_BG_BROWSER_RESULTS_MESSAGE,
  persistMobileBgBrowserResults,
  readMobileBgBrowserResults,
  type MobileBgBrowserResultsMessage,
} from "@/components/saved-searches/mobile-bg-results-bookmarklet";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";

interface UseMobileBgBrowserResultsParams {
  searchId: number | null;
  currentFields: SearchField[];
  results: MobileBgSearchResultsResponse | null;
  setResults: (results: MobileBgSearchResultsResponse | null) => void;
  setResultsError: (message: string) => void;
}

export function useMobileBgBrowserResults({
  searchId,
  currentFields,
  results,
  setResults,
  setResultsError,
}: UseMobileBgBrowserResultsParams) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookmarklet, setBookmarklet] = useState("");
  const [timedOut, setTimedOut] = useState(false);
  const pendingTokenRef = useRef<string | null>(null);
  const pendingFieldsRef = useRef<SearchField[] | null>(null);
  const installBookmarklet = useMemo(() => buildMobileBgResultsBookmarklet(), []);

  const clearImportState = useCallback(() => {
    setLoading(false);
    setNotice("");
    setBookmarklet("");
    setTimedOut(false);
  }, []);

  useEffect(() => {
    if (!searchId || results || loading) return;
    const cachedResults = readMobileBgBrowserResults(searchId);
    if (cachedResults) setResults(cachedResults);
  }, [loading, results, searchId, setResults]);

  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => {
      setTimedOut(true);
      setNotice(
        "Still waiting for the bookmarklet import. You can run the bookmarklet, reopen mobile.bg, or cancel this import.",
      );
    }, 75_000);
    return () => window.clearTimeout(timeout);
  }, [loading]);

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
        message.token !== pendingTokenRef.current ||
        !message.payload
      ) {
        return;
      }

      const incoming = message.payload as MobileBgSearchResultsResponse;
      const merged = mergeMobileBgBrowserResults(results, incoming);
      setResults(merged);
      if (searchId) persistMobileBgBrowserResults(searchId, merged);
      setResultsError("");
      clearImportState();
      toast.success(
        `Imported ${incoming.rows.length} mobile.bg results from the browser`,
      );
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clearImportState, results, searchId, setResults, setResultsError]);

  const cancelImport = useCallback(() => {
    pendingTokenRef.current = null;
    pendingFieldsRef.current = null;
    clearImportState();
  }, [clearImportState]);

  const showInBrowser = useCallback(
    (fields = currentFields) => {
      if (!fields.length) return;
      const token =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      pendingTokenRef.current = token;
      pendingFieldsRef.current = fields;
      setLoading(true);
      setTimedOut(false);
      setResultsError("");
      setResults(null);
      setNotice(
        "Opened mobile.bg in a browser tab. Run the copied scrapeui bookmarklet on that results page to import parsed rows here.",
      );

      const browserSearchWindowName = buildMobileBgBrowserSearchWindowName({
        appOrigin: window.location.origin,
        token,
        fields,
      });
      setBookmarklet(installBookmarklet);

      if (navigator.clipboard?.writeText) {
        void navigator.clipboard
          .writeText(installBookmarklet)
          .then(() => toast.success("Copied the mobile.bg parser bookmarklet"))
          .catch(() => {
            toast.message("Could not copy the bookmarklet automatically", {
              description:
                "Use the parser bookmarklet link shown below the search controls.",
            });
          });
      } else {
        toast.message(
          "Use the parser bookmarklet link shown below the search controls.",
        );
      }
      submitMobileBgSearch(
        fields,
        "scrapeui-mobile-bg-browser-search",
        browserSearchWindowName,
      );
    },
    [currentFields, installBookmarklet, setResults, setResultsError],
  );

  const reopenSearch = useCallback(() => {
    const fields = pendingFieldsRef.current ?? currentFields;
    if (!fields.length) return;
    const token = pendingTokenRef.current;
    if (!token) {
      showInBrowser(fields);
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
  }, [currentFields, showInBrowser]);

  return {
    loading,
    notice,
    bookmarklet,
    timedOut,
    installBookmarklet,
    showInBrowser,
    reopenSearch,
    cancelImport,
    reset: clearImportState,
  };
}
