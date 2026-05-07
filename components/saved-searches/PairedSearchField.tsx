import { SavedSearchPrimitiveInput } from "@/components/saved-searches/SavedSearchPrimitiveInput";
import { getSavedSearchFieldLabel } from "@/components/saved-searches/field-display-helpers";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CLEARABLE_FIELDS,
  MOBILE_BG_HEADER_STEPPER_FIELDS,
  MOBILE_BG_HIDDEN_FIELD_CODE_NAMES,
} from "@/lib/mobile-bg/search-field-config";

export function PairedSearchField({
  fields,
  className,
  subLocationLabel,
  locationOptions,
  subLocationOptions,
  locationLoading,
  onClear,
  onNudge,
  onUpdateField,
  onUpdateLocation,
}: {
  fields: [SearchField, SearchField];
  className: string;
  subLocationLabel: string;
  locationOptions: SearchPrefillData["options"]["locations"];
  subLocationOptions: SearchPrefillData["options"]["subLocations"]["options"];
  locationLoading: boolean;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
  onUpdateField: (name: string, value: string) => void;
  onUpdateLocation: (value: string) => void | Promise<void>;
}) {
  function renderInput(field: SearchField) {
    return (
      <SavedSearchPrimitiveInput
        field={field}
        locationOptions={locationOptions}
        subLocationOptions={subLocationOptions}
        locationLoading={locationLoading}
        onUpdateField={onUpdateField}
        onUpdateLocation={onUpdateLocation}
      />
    );
  }

  return (
    <div
      className={`min-w-0 rounded border border-gray-700 bg-gray-800/70 px-2.5 py-2 ${className}`}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const label = getSavedSearchFieldLabel(field, subLocationLabel);
          const stepperDelta = MOBILE_BG_HEADER_STEPPER_FIELDS[field.name] ?? null;

          return (
            <div key={field.name} className="min-w-0">
              <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                <div className="truncate text-xs font-medium text-gray-300">
                  {label}
                </div>
                {stepperDelta != null ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
                      onClick={() => onNudge(field.name, -stepperDelta)}
                      aria-label={`Decrease ${label}`}
                    >
                      -{stepperDelta}
                    </button>
                    <button
                      type="button"
                      className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
                      onClick={() => onNudge(field.name, stepperDelta)}
                      aria-label={`Increase ${label}`}
                    >
                      +{stepperDelta}
                    </button>
                  </div>
                ) : MOBILE_BG_CLEARABLE_FIELDS.has(field.name) && field.value ? (
                  <button
                    type="button"
                    className="h-5 rounded border border-gray-600 px-1.5 text-[10px] leading-none text-gray-300 hover:bg-gray-700"
                    onClick={() => onClear(field.name)}
                  >
                    Clear
                  </button>
                ) : MOBILE_BG_HIDDEN_FIELD_CODE_NAMES.has(field.name) ? null : (
                  <div className="shrink-0 text-[10px] uppercase tracking-wide text-gray-500">
                    {field.name}
                  </div>
                )}
              </div>
              {renderInput(field)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
