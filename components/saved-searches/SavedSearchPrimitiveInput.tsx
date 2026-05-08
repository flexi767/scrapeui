import { Loader2 } from "lucide-react";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CATEGORY_OPTIONS,
  MOBILE_BG_ENGINE_OPTIONS,
  MOBILE_BG_TRANSMISSION_OPTIONS,
} from "@/lib/mobile-bg/search-field-config";

const DEFAULT_INPUT_CLASS_NAME =
  "h-9 w-full rounded border border-gray-500 bg-gray-100 px-2.5 py-1.5 text-sm text-gray-950 focus:border-blue-500 focus:outline-none";

function SavedSearchSelect({
  value,
  options,
  emptyLabel,
  className,
  onChange,
}: {
  value: string;
  options: string[];
  emptyLabel: string;
  className: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    >
      {options.map((option) => (
        <option key={option || emptyLabel} value={option}>
          {option || emptyLabel}
        </option>
      ))}
    </select>
  );
}

export function SavedSearchPrimitiveInput({
  field,
  locationOptions,
  subLocationOptions,
  locationLoading,
  className = DEFAULT_INPUT_CLASS_NAME,
  onUpdateField,
  onUpdateLocation,
}: {
  field: SearchField;
  locationOptions: SearchPrefillData["options"]["locations"];
  subLocationOptions: SearchPrefillData["options"]["subLocations"]["options"];
  locationLoading: boolean;
  className?: string;
  onUpdateField: (name: string, value: string) => void;
  onUpdateLocation: (value: string) => void | Promise<void>;
}) {
  if (field.name === "f12") {
    return (
      <SavedSearchSelect
        value={field.value}
        options={MOBILE_BG_ENGINE_OPTIONS}
        emptyLabel="Всички типове"
        className={className}
        onChange={(value) => onUpdateField(field.name, value)}
      />
    );
  }

  if (field.name === "f13") {
    return (
      <SavedSearchSelect
        value={field.value}
        options={MOBILE_BG_TRANSMISSION_OPTIONS}
        emptyLabel="Без значение"
        className={className}
        onChange={(value) => onUpdateField(field.name, value)}
      />
    );
  }

  if (field.name === "f14") {
    return (
      <SavedSearchSelect
        value={field.value}
        options={MOBILE_BG_CATEGORY_OPTIONS}
        emptyLabel="всички категории"
        className={className}
        onChange={(value) => onUpdateField(field.name, value)}
      />
    );
  }

  if (field.name === "f17") {
    return (
      <select
        value={field.value}
        onChange={(event) => void onUpdateLocation(event.target.value)}
        className={className}
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
          className={`${className} pr-10 disabled:cursor-wait`}
        >
          <option value="">всички</option>
          {subLocationOptions
            .filter((option) => option.value !== "")
            .map((option) => (
              <option key={`${option.value}-${option.label}`} value={option.value}>
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
      className={className}
    />
  );
}
