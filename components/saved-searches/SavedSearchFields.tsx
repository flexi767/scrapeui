import { useMemo } from "react";
import { SavedSearchAutocompleteField } from "@/components/saved-searches/SavedSearchAutocompleteField";
import { SavedSearchFieldHeader } from "@/components/saved-searches/SavedSearchFieldHeader";
import { PairedSearchField } from "@/components/saved-searches/PairedSearchField";
import { SavedSearchPrimitiveInput } from "@/components/saved-searches/SavedSearchPrimitiveInput";
import { SavedSearchTextInput } from "@/components/saved-searches/SavedSearchTextInput";
import {
  getSavedSearchFieldLabel,
  getSavedSearchFieldLayoutClass,
  isSavedSearchAutocompleteField,
  isSavedSearchPrimitiveField,
  orderSavedSearchFieldsForDisplay,
} from "@/components/saved-searches/field-display-helpers";
import {
  getSelectedOptionCount,
  normalizeAutocompleteValue,
  sortMakeOptions,
} from "@/components/new-listing-form/autocomplete";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_HEADER_STEPPER_FIELDS,
  MOBILE_BG_HIDDEN_FIELD_NAMES,
  MOBILE_BG_PAIRED_FIELD_END_NAMES,
  MOBILE_BG_PAIRED_FIELD_NAMES,
} from "@/lib/mobile-bg/search-field-config";

export function SavedSearchFields({
  fields,
  prefillOptions,
  subLocationLabel,
  subLocationOptions,
  locationLoading,
  openAutocomplete,
  getFieldValue,
  onClear,
  onNudge,
  onOpenAutocompleteChange,
  onUpdateField,
  onUpdateLocation,
  onUpdateMake,
}: {
  fields: SearchField[];
  prefillOptions: SearchPrefillData["options"];
  subLocationLabel: string;
  subLocationOptions: SearchPrefillData["options"]["subLocations"]["options"];
  locationLoading: boolean;
  openAutocomplete: "marka" | "model" | null;
  getFieldValue: (name: string) => string;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
  onOpenAutocompleteChange: (
    updater:
      | "marka"
      | "model"
      | null
      | ((current: "marka" | "model" | null) => "marka" | "model" | null),
  ) => void;
  onUpdateField: (name: string, value: string) => void;
  onUpdateLocation: (value: string) => void | Promise<void>;
  onUpdateMake: (value: string) => void;
}) {
  const visibleFields = useMemo(
    () =>
      orderSavedSearchFieldsForDisplay(
        fields.filter(
          (field) => !MOBILE_BG_HIDDEN_FIELD_NAMES.has(field.name),
        ),
      ),
    [fields],
  );
  const selectedMake = getFieldValue("marka");
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

  return (
    <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
      {visibleFields.map((field) => {
        if (MOBILE_BG_PAIRED_FIELD_END_NAMES.has(field.name)) return null;

        const pairedField =
          MOBILE_BG_PAIRED_FIELD_NAMES[field.name] != null
            ? fields.find(
                (item) =>
                  item.name === MOBILE_BG_PAIRED_FIELD_NAMES[field.name],
              )
            : null;
        const selectedMakeCount =
          field.name === "marka"
            ? getSelectedOptionCount(makeOptions, field.value)
            : null;
        const selectedModelCount =
          field.name === "model"
            ? getSelectedOptionCount(modelOptions, field.value)
            : null;
        const selectedReferenceCount = selectedMakeCount ?? selectedModelCount;
        const autocompleteOptions =
          field.name === "marka" ? makeOptions : modelOptions;
        const autocompleteKind = isSavedSearchAutocompleteField(field.name)
          ? field.name
          : null;
        const fieldLabel = getSavedSearchFieldLabel(field, subLocationLabel);
        const headerStepperDelta =
          MOBILE_BG_HEADER_STEPPER_FIELDS[field.name] ?? null;

        if (pairedField) {
          return (
            <PairedSearchField
              key={field.name}
              fields={[field, pairedField]}
              className={getSavedSearchFieldLayoutClass(field.name)}
              subLocationLabel={subLocationLabel}
              locationOptions={prefillOptions.locations}
              subLocationOptions={subLocationOptions}
              locationLoading={locationLoading}
              onClear={onClear}
              onNudge={onNudge}
              onUpdateField={onUpdateField}
              onUpdateLocation={onUpdateLocation}
            />
          );
        }

        return (
          <div
            key={field.name}
            className={`min-w-0 rounded border border-gray-700 bg-gray-800/70 px-2.5 py-2 ${getSavedSearchFieldLayoutClass(field.name)}`}
          >
            <SavedSearchFieldHeader
              name={field.name}
              label={fieldLabel}
              stepperDelta={headerStepperDelta}
              onClear={onClear}
              onNudge={onNudge}
            />
            <div className="min-w-0">
              {autocompleteKind ? (
                <SavedSearchAutocompleteField
                  field={field}
                  kind={autocompleteKind}
                  options={autocompleteOptions}
                  selectedCount={selectedReferenceCount}
                  openAutocomplete={openAutocomplete}
                  onOpenAutocompleteChange={onOpenAutocompleteChange}
                  onUpdateField={onUpdateField}
                  onUpdateMake={onUpdateMake}
                />
              ) : isSavedSearchPrimitiveField(field.name) ? (
                <SavedSearchPrimitiveInput
                  field={field}
                  locationOptions={prefillOptions.locations}
                  subLocationOptions={subLocationOptions}
                  locationLoading={locationLoading}
                  onUpdateField={onUpdateField}
                  onUpdateLocation={onUpdateLocation}
                />
              ) : (
                <SavedSearchTextInput
                  field={field}
                  headerStepperDelta={headerStepperDelta}
                  onClear={onClear}
                  onNudge={onNudge}
                  onUpdateField={onUpdateField}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
