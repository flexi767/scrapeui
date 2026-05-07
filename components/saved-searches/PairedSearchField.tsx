import { SavedSearchFieldHeader } from "@/components/saved-searches/SavedSearchFieldHeader";
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
              <SavedSearchFieldHeader
                name={field.name}
                label={label}
                stepperDelta={stepperDelta}
                showClear={
                  MOBILE_BG_CLEARABLE_FIELDS.has(field.name) && Boolean(field.value)
                }
                showCode={!MOBILE_BG_HIDDEN_FIELD_CODE_NAMES.has(field.name)}
                onClear={onClear}
                onNudge={onNudge}
              />
              <SavedSearchPrimitiveInput
                field={field}
                locationOptions={locationOptions}
                subLocationOptions={subLocationOptions}
                locationLoading={locationLoading}
                onUpdateField={onUpdateField}
                onUpdateLocation={onUpdateLocation}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
