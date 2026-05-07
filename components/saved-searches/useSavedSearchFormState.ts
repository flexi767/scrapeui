"use client";

import { useCallback, useState } from "react";
import {
  fetchLocationOptions,
  type SavedSearchDetailResponse,
} from "@/components/saved-searches/api";
import {
  didMakeOrModelChange,
  mergeEditableFields,
  normalizeLocationOptions,
} from "@/components/saved-searches/helpers";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";

type SavedSearchDetail = SavedSearchDetailResponse["detail"];

export function useSavedSearchFormState(initialDetail: SavedSearchDetail | null) {
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
  const [locationLoading, setLocationLoading] = useState(false);
  const [openAutocomplete, setOpenAutocomplete] = useState<
    "marka" | "model" | null
  >(null);

  const loadFromDetail = useCallback((detail: SavedSearchDetail) => {
    setEditableFields(detail.prefill.form.fields.map((field) => ({ ...field })));
    setSubLocationLabel(detail.prefill.options.subLocations.label);
    setSubLocationOptions(detail.prefill.options.subLocations.options);
  }, []);

  const reset = useCallback(() => {
    setEditableFields([]);
    setSubLocationLabel("Населено място");
    setSubLocationOptions([{ value: "", label: "всички" }]);
    setLocationLoading(false);
    setOpenAutocomplete(null);
  }, []);

  const currentFields = useCallback(
    (detail: SavedSearchDetail | null) => {
      if (!detail) return [];
      return mergeEditableFields(detail.prefill.form.fields, editableFields);
    },
    [editableFields],
  );

  const updateField = useCallback((name: string, value: string) => {
    setEditableFields((prev) =>
      prev.map((field) => (field.name === name ? { ...field, value } : field)),
    );
  }, []);

  const getFieldValue = useCallback(
    (name: string) =>
      editableFields.find((field) => field.name === name)?.value ?? "",
    [editableFields],
  );

  const updateMake = useCallback(
    (detail: SavedSearchDetail | null, value: string) => {
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
    },
    [],
  );

  const updateLocation = useCallback(
    async (value: string) => {
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
    },
    [updateField],
  );

  const nudgeField = useCallback((name: string, delta: number) => {
    setEditableFields((prev) =>
      prev.map((field) => {
        if (field.name !== name) return field;
        const parsed = Number.parseInt(field.value || "0", 10);
        const base = Number.isFinite(parsed) ? parsed : 0;
        return { ...field, value: String(base + delta) };
      }),
    );
  }, []);

  const clearField = useCallback(
    (name: string) => {
      updateField(name, "");
    },
    [updateField],
  );

  const getMakeOrModelChanged = useCallback(
    (detail: SavedSearchDetail | null) =>
      detail
        ? didMakeOrModelChange(detail.prefill.form.fields, currentFields(detail))
        : false,
    [currentFields],
  );

  return {
    editableFields,
    subLocationLabel,
    subLocationOptions,
    locationLoading,
    openAutocomplete,
    setOpenAutocomplete,
    loadFromDetail,
    reset,
    getCurrentFields: currentFields,
    getMakeOrModelChanged,
    getFieldValue,
    updateField,
    updateMake,
    updateLocation,
    nudgeField,
    clearField,
  };
}
