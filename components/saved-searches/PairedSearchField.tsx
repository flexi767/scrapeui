import { Loader2 } from "lucide-react";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CATEGORY_OPTIONS,
  MOBILE_BG_CLEARABLE_FIELDS,
  MOBILE_BG_ENGINE_OPTIONS,
  MOBILE_BG_HEADER_STEPPER_FIELDS,
  MOBILE_BG_HIDDEN_FIELD_CODE_NAMES,
  MOBILE_BG_TRANSMISSION_OPTIONS,
} from "@/lib/mobile-bg/search-field-config";

function displayFieldLabel(field: SearchField, subLocationLabel: string) {
  if (field.name === "f18") return subLocationLabel;
  if (field.name === "f25" || field.name === "f26") {
    return field.label.replace(/\s*\[к\.с\.\]\s*/g, "");
  }
  return field.label;
}

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
    const inputClassName =
      "h-9 w-full rounded border border-gray-500 bg-gray-100 px-2.5 py-1.5 text-sm text-gray-950 focus:border-blue-500 focus:outline-none";

    if (field.name === "f12") {
      return (
        <select
          value={field.value}
          onChange={(event) => onUpdateField(field.name, event.target.value)}
          className={inputClassName}
        >
          {MOBILE_BG_ENGINE_OPTIONS.map((option) => (
            <option key={option || "engine-all"} value={option}>
              {option || "Всички типове"}
            </option>
          ))}
        </select>
      );
    }

    if (field.name === "f13") {
      return (
        <select
          value={field.value}
          onChange={(event) => onUpdateField(field.name, event.target.value)}
          className={inputClassName}
        >
          {MOBILE_BG_TRANSMISSION_OPTIONS.map((option) => (
            <option key={option || "trans-all"} value={option}>
              {option || "Без значение"}
            </option>
          ))}
        </select>
      );
    }

    if (field.name === "f14") {
      return (
        <select
          value={field.value}
          onChange={(event) => onUpdateField(field.name, event.target.value)}
          className={inputClassName}
        >
          {MOBILE_BG_CATEGORY_OPTIONS.map((option) => (
            <option key={option || "cat-all"} value={option}>
              {option || "всички категории"}
            </option>
          ))}
        </select>
      );
    }

    if (field.name === "f17") {
      return (
        <select
          value={field.value}
          onChange={(event) => void onUpdateLocation(event.target.value)}
          className={inputClassName}
        >
          {locationOptions.map((option) => (
            <option
              key={`${option.value || "loc-all"}-${option.label}`}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.name === "f18") {
      return (
        <div className="relative">
          <select
            value={field.value}
            onChange={(event) => onUpdateField(field.name, event.target.value)}
            disabled={locationLoading}
            className={`${inputClassName} pr-10 disabled:cursor-wait`}
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
      );
    }

    return (
      <input
        value={field.value}
        onChange={(event) => onUpdateField(field.name, event.target.value)}
        className={inputClassName}
      />
    );
  }

  return (
    <div
      className={`min-w-0 rounded border border-gray-700 bg-gray-800/70 px-2.5 py-2 ${className}`}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((field) => {
          const label = displayFieldLabel(field, subLocationLabel);
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
