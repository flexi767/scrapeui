"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  createSavedSearch,
  deleteSavedSearch,
  type SavedSearchDetailResponse,
  updateSavedSearch,
} from "@/components/saved-searches/api";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";
import { errorMessage } from "@/lib/utils";

type SavedSearchDetail = SavedSearchDetailResponse["detail"];

export function useSavedSearchActions({
  detail,
  currentFields,
  setSearches,
  setSelectedId,
  syncFromDetail,
  onDeletedLast,
}: {
  detail: SavedSearchDetail | null;
  currentFields: SearchField[];
  setSearches: (searches: SavedSearchSummary[]) => void;
  setSelectedId: (id: number | null) => void;
  syncFromDetail: (detail: SavedSearchDetail) => void;
  onDeletedLast: () => void;
}) {
  const [saveBusy, setSaveBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const saveCurrent = useCallback(async () => {
    if (!detail) return;
    setSaveBusy(true);
    try {
      const data = await updateSavedSearch(detail.search.id, currentFields);
      setSearches(data.searches);
      syncFromDetail(data.detail);
      toast.success("Saved search updated");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to save search"));
    } finally {
      setSaveBusy(false);
    }
  }, [currentFields, detail, setSearches, syncFromDetail]);

  const saveAsNew = useCallback(async () => {
    if (!detail) return;
    setCloneBusy(true);
    try {
      const data = await createSavedSearch(currentFields);
      setSearches(data.searches);
      syncFromDetail(data.detail);
      setSelectedId(data.detail.search.id);
      toast.success("Created a new saved search");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create saved search"));
    } finally {
      setCloneBusy(false);
    }
  }, [currentFields, detail, setSearches, setSelectedId, syncFromDetail]);

  const deleteCurrent = useCallback(async () => {
    if (!detail) return false;

    setDeleteBusy(true);
    try {
      const data = await deleteSavedSearch(detail.search.id);
      const nextSearches = data.searches;
      setSearches(nextSearches);

      const nextSelectedId =
        nextSearches.find((search) => search.id !== detail.search.id)?.id ??
        null;
      setSelectedId(nextSelectedId);
      if (nextSelectedId == null) onDeletedLast();

      toast.success("Saved search deleted");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete saved search"));
      return false;
    } finally {
      setDeleteBusy(false);
    }
  }, [detail, onDeletedLast, setSearches, setSelectedId]);

  return {
    saveBusy,
    cloneBusy,
    deleteBusy,
    saveCurrent,
    saveAsNew,
    deleteCurrent,
  };
}
