import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  MOBILE_BG_CLEARABLE_FIELDS,
  MOBILE_BG_STEPPER_FIELDS,
} from "@/lib/mobile-bg/search-field-config";

export function SavedSearchTextInput({
  field,
  headerStepperDelta,
  onClear,
  onNudge,
  onUpdateField,
}: {
  field: SearchField;
  headerStepperDelta: number | null;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
  onUpdateField: (name: string, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={field.value}
        onChange={(event) => onUpdateField(field.name, event.target.value)}
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
      {MOBILE_BG_CLEARABLE_FIELDS.has(field.name) && field.value ? (
        <button
          type="button"
          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
          onClick={() => onClear(field.name)}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
