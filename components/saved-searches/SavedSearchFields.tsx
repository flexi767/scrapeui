import { PairedSearchField } from "@/components/saved-searches/PairedSearchField";
import { SavedSearchPrimitiveInput } from "@/components/saved-searches/SavedSearchPrimitiveInput";
import {
  getSavedSearchFieldLabel,
  getSavedSearchFieldLayoutClass,
  orderSavedSearchFieldsForDisplay,
} from "@/components/saved-searches/field-display-helpers";
import {
  AutocompleteInput,
  getSelectedOptionCount,
  normalizeAutocompleteValue,
  sortMakeOptions,
} from "@/components/new-listing-form/autocomplete";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CLEARABLE_FIELDS,
  MOBILE_BG_HEADER_STEPPER_FIELDS,
  MOBILE_BG_HIDDEN_FIELD_NAMES,
  MOBILE_BG_PAIRED_FIELD_END_NAMES,
  MOBILE_BG_PAIRED_FIELD_NAMES,
  MOBILE_BG_STEPPER_FIELDS,
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
  return (
    <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
      {orderSavedSearchFieldsForDisplay(
        fields.filter((field) => !MOBILE_BG_HIDDEN_FIELD_NAMES.has(field.name)),
      ).map((field) => {
        if (MOBILE_BG_PAIRED_FIELD_END_NAMES.has(field.name)) return null;

        const pairedField =
          MOBILE_BG_PAIRED_FIELD_NAMES[field.name] != null
            ? fields.find(
                (item) =>
                  item.name === MOBILE_BG_PAIRED_FIELD_NAMES[field.name],
              )
            : null;
        const selectedMake = getFieldValue("marka");
        const matchedMakeKey =
          Object.keys(prefillOptions.modelsByMake).find(
            (make) =>
              normalizeAutocompleteValue(make) ===
              normalizeAutocompleteValue(selectedMake),
          ) ?? selectedMake;
        const modelOptions = (
          prefillOptions.modelsByMake[matchedMakeKey] ?? []
        ).map((option) => ({
          value: option.value,
          count: option.count,
        }));
        const makeOptions = sortMakeOptions(
          prefillOptions.makes.map((option) => ({
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
        const selectedReferenceCount = selectedMakeCount ?? selectedModelCount;
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
            <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
              <div className="truncate text-xs font-medium text-gray-300">
                {fieldLabel}
              </div>
              {headerStepperDelta != null ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
                    onClick={() => onNudge(field.name, -headerStepperDelta)}
                    aria-label={`Decrease ${fieldLabel}`}
                  >
                    -{headerStepperDelta}
                  </button>
                  <button
                    type="button"
                    className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
                    onClick={() => onNudge(field.name, headerStepperDelta)}
                    aria-label={`Increase ${fieldLabel}`}
                  >
                    +{headerStepperDelta}
                  </button>
                </div>
              ) : (
                <div className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                  {field.name}
                </div>
              )}
            </div>
            <div className="min-w-0">
              {field.name === "marka" ? (
                <AutocompleteInput
                  value={field.value}
                  onChange={onUpdateMake}
                  options={makeOptions}
                  placeholder="Type make"
                  emptyLabel="No make matches"
                  hideLowCountOnEmpty
                  open={openAutocomplete === "marka"}
                  focusWhenOpen
                  trailingText={
                    selectedReferenceCount != null
                      ? selectedReferenceCount.toLocaleString("en-US")
                      : null
                  }
                  onOpenChange={(open) => {
                    if (open) {
                      onOpenAutocompleteChange("marka");
                      return;
                    }
                    onOpenAutocompleteChange((current) =>
                      current === "marka" ? null : current,
                    );
                  }}
                />
              ) : field.name === "model" ? (
                <AutocompleteInput
                  value={field.value}
                  onChange={(value) => onUpdateField(field.name, value)}
                  options={modelOptions}
                  placeholder="Type model"
                  emptyLabel="No model matches"
                  focusWhenOpen
                  open={openAutocomplete === "model"}
                  onArrowLeft={() => onOpenAutocompleteChange("marka")}
                  trailingText={
                    selectedReferenceCount != null
                      ? selectedReferenceCount.toLocaleString("en-US")
                      : null
                  }
                  onOpenChange={(open) => {
                    if (open) {
                      onOpenAutocompleteChange("model");
                      return;
                    }
                    onOpenAutocompleteChange((current) =>
                      current === "model" ? null : current,
                    );
                  }}
                />
              ) : ["f12", "f13", "f14", "f17", "f18"].includes(field.name) ? (
                <SavedSearchPrimitiveInput
                  field={field}
                  locationOptions={prefillOptions.locations}
                  subLocationOptions={subLocationOptions}
                  locationLoading={locationLoading}
                  onUpdateField={onUpdateField}
                  onUpdateLocation={onUpdateLocation}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    value={field.value}
                    onChange={(event) =>
                      onUpdateField(field.name, event.target.value)
                    }
                    className="h-9 min-w-0 flex-1 rounded border border-gray-500 bg-gray-100 px-2.5 py-1.5 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                  />
                  {MOBILE_BG_STEPPER_FIELDS.has(field.name) &&
                    headerStepperDelta == null && (
                      <>
                        <button
                          type="button"
                          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                          onClick={() => onNudge(field.name, -1)}
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                          onClick={() => onNudge(field.name, 1)}
                        >
                          +1
                        </button>
                      </>
                    )}
                  {MOBILE_BG_CLEARABLE_FIELDS.has(field.name) &&
                    field.value && (
                      <button
                        type="button"
                        className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                        onClick={() => onClear(field.name)}
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
  );
}
