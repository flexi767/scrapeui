import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CATEGORY_OPTIONS,
  MOBILE_BG_CLEARABLE_FIELDS,
  MOBILE_BG_ENGINE_OPTIONS,
  MOBILE_BG_HIDDEN_FIELD_NAMES,
  MOBILE_BG_STEPPER_FIELDS,
  MOBILE_BG_TRANSMISSION_OPTIONS,
} from "@/lib/mobile-bg/search-field-config";

interface SearchPrefillFieldsProps {
  fields: SearchField[];
  makes: Array<{ value: string; count: number | null }>;
  modelsByMake: Record<string, Array<{ value: string; count: number | null }>>;
  locations: Array<{ value: string; label: string }>;
  subLocationLabel: string;
  subLocationOptions: Array<{ value: string; label: string }>;
  locationLoading: boolean;
  getFieldValue: (name: string) => string;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
  onUpdateField: (name: string, value: string) => void;
  onUpdateLocation: (value: string) => void | Promise<void>;
  onUpdateMake: (value: string) => void;
}

function normalizeOptionValue(value: string) {
  return value.trim().toLowerCase();
}

function getSelectedOptionCount(
  options: Array<{ value: string; count?: number | null }>,
  value: string,
) {
  const normalizedValue = normalizeOptionValue(value);
  if (!normalizedValue) return null;
  const match = options.find(
    (option) => normalizeOptionValue(option.value) === normalizedValue,
  );
  return match?.count ?? null;
}

export function SearchPrefillFields({
  fields,
  makes,
  modelsByMake,
  locations,
  subLocationLabel,
  subLocationOptions,
  locationLoading,
  getFieldValue,
  onClear,
  onNudge,
  onUpdateField,
  onUpdateLocation,
  onUpdateMake,
}: SearchPrefillFieldsProps) {
  const selectedMake = getFieldValue("marka");
  const modelOptions = modelsByMake[selectedMake] ?? [];

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {fields
        .filter((field) => !MOBILE_BG_HIDDEN_FIELD_NAMES.has(field.name))
        .map((field) => {
          const selectedReferenceCount =
            field.name === "marka"
              ? getSelectedOptionCount(makes, field.value)
              : field.name === "model"
                ? getSelectedOptionCount(modelOptions, field.value)
                : null;

          return (
            <div
              key={field.name}
              className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center gap-3 rounded border border-slate-500/60 bg-slate-700/90 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-slate-50">
                  {field.name === "f18" ? subLocationLabel : field.label}
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-200/60">
                  {field.name}
                </div>
              </div>
              <div className="min-w-0">
                {field.name === "marka" ? (
                  <div className="relative">
                    <select
                      value={field.value}
                      onChange={(event) => onUpdateMake(event.target.value)}
                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-14 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select make</option>
                      {makes.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value}
                          {option.count != null
                            ? ` (${option.count.toLocaleString("en-US")})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    {selectedReferenceCount != null && (
                      <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {selectedReferenceCount.toLocaleString("en-US")}
                      </div>
                    )}
                  </div>
                ) : field.name === "f12" ? (
                  <select
                    value={field.value}
                    onChange={(event) =>
                      onUpdateField(field.name, event.target.value)
                    }
                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                  >
                    {MOBILE_BG_ENGINE_OPTIONS.map((option) => (
                      <option key={option || "all-engines"} value={option}>
                        {option || "Всички типове"}
                      </option>
                    ))}
                  </select>
                ) : field.name === "f13" ? (
                  <select
                    value={field.value}
                    onChange={(event) =>
                      onUpdateField(field.name, event.target.value)
                    }
                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                  >
                    {MOBILE_BG_TRANSMISSION_OPTIONS.map((option) => (
                      <option key={option || "all-transmissions"} value={option}>
                        {option || "Без значение"}
                      </option>
                    ))}
                  </select>
                ) : field.name === "f14" ? (
                  <select
                    value={field.value}
                    onChange={(event) =>
                      onUpdateField(field.name, event.target.value)
                    }
                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                  >
                    {MOBILE_BG_CATEGORY_OPTIONS.map((option) => (
                      <option key={option || "all-categories"} value={option}>
                        {option || "всички категории"}
                      </option>
                    ))}
                  </select>
                ) : field.name === "f17" ? (
                  <select
                    value={field.value}
                    onChange={(event) => void onUpdateLocation(event.target.value)}
                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                  >
                    {locations.map((option) => (
                      <option
                        key={`${option.value || "all-locations"}-${option.label}`}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : field.name === "f18" ? (
                  <div className="relative">
                    <select
                      value={field.value}
                      onChange={(event) =>
                        onUpdateField(field.name, event.target.value)
                      }
                      disabled={locationLoading}
                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-10 text-sm text-slate-950 focus:border-blue-500 focus:outline-none disabled:cursor-wait disabled:bg-slate-200"
                    >
                      <option value="">всички</option>
                      {subLocationOptions
                        .filter((option) => option.value !== "")
                        .map((option) => (
                          <option
                            key={`${option.value || "all-sub-locations"}-${option.label}`}
                            value={option.value}
                          >
                            {option.label}
                          </option>
                        ))}
                    </select>
                    {locationLoading && (
                      <span className="pointer-events-none absolute right-3 top-1/2 inline-block h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-500 border-t-sky-500" />
                    )}
                  </div>
                ) : field.name === "model" ? (
                  <div className="relative">
                    <select
                      value={field.value}
                      onChange={(event) =>
                        onUpdateField(field.name, event.target.value)
                      }
                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-14 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select model</option>
                      {modelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.value}
                          {option.count != null
                            ? ` (${option.count.toLocaleString("en-US")})`
                            : ""}
                        </option>
                      ))}
                    </select>
                    {selectedReferenceCount != null && (
                      <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {selectedReferenceCount.toLocaleString("en-US")}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-stretch gap-2">
                    <input
                      value={field.value}
                      onChange={(event) =>
                        onUpdateField(field.name, event.target.value)
                      }
                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                    />
                    {MOBILE_BG_STEPPER_FIELDS.has(field.name) && (
                      <div className="flex shrink-0 flex-col overflow-hidden rounded border border-slate-400/70">
                        <button
                          type="button"
                          onClick={() => onNudge(field.name, 1)}
                          className="h-5 w-7 bg-slate-200 text-xs font-semibold text-slate-950 hover:bg-slate-300"
                          aria-label={`Increase ${field.label}`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onNudge(field.name, -1)}
                          className="h-5 w-7 border-t border-slate-400/70 bg-slate-200 text-xs font-semibold text-slate-950 hover:bg-slate-300"
                          aria-label={`Decrease ${field.label}`}
                        >
                          -
                        </button>
                      </div>
                    )}
                    {MOBILE_BG_CLEARABLE_FIELDS.has(field.name) && (
                      <button
                        type="button"
                        onClick={() => onClear(field.name)}
                        className="shrink-0 rounded border border-slate-400/70 bg-slate-200 px-2 text-sm font-semibold text-slate-950 hover:bg-slate-300"
                        aria-label={`Clear ${field.label}`}
                      >
                        x
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-200/60">
                  {field.source}
                </div>
              </div>
            </div>
          );
        })}
    </div>
  );
}
