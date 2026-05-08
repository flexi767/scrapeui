import { useMemo } from "react";
import {
  getSelectedOptionCount,
  normalizeAutocompleteValue,
  sortMakeOptions,
} from "@/components/new-listing-form/autocomplete";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";

export function useSavedSearchAutocompleteOptions({
  selectedMake,
  prefillOptions,
}: {
  selectedMake: string;
  prefillOptions: SearchPrefillData["options"];
}) {
  const makeOptions = useMemo(
    () =>
      sortMakeOptions(
        prefillOptions.makes.map((option) => ({
          value: option.value,
          count: option.count,
        })),
      ),
    [prefillOptions.makes],
  );

  const modelOptions = useMemo(() => {
    const matchedMakeKey =
      Object.keys(prefillOptions.modelsByMake).find(
        (make) =>
          normalizeAutocompleteValue(make) ===
          normalizeAutocompleteValue(selectedMake),
      ) ?? selectedMake;

    return (prefillOptions.modelsByMake[matchedMakeKey] ?? []).map(
      (option) => ({
        value: option.value,
        count: option.count,
      }),
    );
  }, [prefillOptions.modelsByMake, selectedMake]);

  function getSelectedCount(name: string, value: string) {
    if (name === "marka") return getSelectedOptionCount(makeOptions, value);
    if (name === "model") return getSelectedOptionCount(modelOptions, value);
    return null;
  }

  return {
    makeOptions,
    modelOptions,
    getSelectedCount,
  };
}
