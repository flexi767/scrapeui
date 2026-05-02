import { SavedSearchEditorHeader } from "@/components/saved-searches/SavedSearchEditorHeader";
import { SavedSearchFields } from "@/components/saved-searches/SavedSearchFields";
import type { SavedSearchDetailResponse } from "@/components/saved-searches/api";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";

interface SavedSearchEditorPanelProps {
  detail: NonNullable<SavedSearchDetailResponse["detail"]>;
  fields: SearchField[];
  subLocationLabel: string;
  subLocationOptions: Array<{ value: string; label: string }>;
  locationLoading: boolean;
  openAutocomplete: "marka" | "model" | null;
  resultsLoading: boolean;
  saveAdMode: boolean;
  makeOrModelChanged: boolean;
  saveBusy: boolean;
  cloneBusy: boolean;
  deleteBusy: boolean;
  getFieldValue: (name: string) => string;
  onShowFirst: () => void;
  onShowAll: () => void;
  onOpenMobileBg: () => void;
  onSaveAd: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
  onClear: (name: string) => void;
  onNudge: (name: string, delta: number) => void;
  onOpenAutocompleteChange: (updater: "marka" | "model" | null | ((current: "marka" | "model" | null) => "marka" | "model" | null)) => void;
  onUpdateField: (name: string, value: string) => void;
  onUpdateLocation: (value: string) => void;
  onUpdateMake: (value: string) => void;
}

export function SavedSearchEditorPanel({
  detail,
  fields,
  subLocationLabel,
  subLocationOptions,
  locationLoading,
  openAutocomplete,
  resultsLoading,
  saveAdMode,
  makeOrModelChanged,
  saveBusy,
  cloneBusy,
  deleteBusy,
  getFieldValue,
  onShowFirst,
  onShowAll,
  onOpenMobileBg,
  onSaveAd,
  onSave,
  onSaveAsNew,
  onDelete,
  onClear,
  onNudge,
  onOpenAutocompleteChange,
  onUpdateField,
  onUpdateLocation,
  onUpdateMake,
}: SavedSearchEditorPanelProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70">
      <SavedSearchEditorHeader
        listing={detail.prefill.listing ?? null}
        resultsLoading={resultsLoading}
        saveAdMode={saveAdMode}
        makeOrModelChanged={makeOrModelChanged}
        saveBusy={saveBusy}
        cloneBusy={cloneBusy}
        deleteBusy={deleteBusy}
        onShowFirst={onShowFirst}
        onShowAll={onShowAll}
        onOpenMobileBg={onOpenMobileBg}
        onSaveAd={onSaveAd}
        onSave={onSave}
        onSaveAsNew={onSaveAsNew}
        onDelete={onDelete}
      />
      {detail.prefill.omitted.length > 0 && (
        <div className="px-4 pt-3 text-xs text-amber-300/80">
          {detail.prefill.omitted.join(" ")}
        </div>
      )}
      <SavedSearchFields
        fields={fields}
        prefillOptions={detail.prefill.options}
        subLocationLabel={subLocationLabel}
        subLocationOptions={subLocationOptions}
        locationLoading={locationLoading}
        openAutocomplete={openAutocomplete}
        getFieldValue={getFieldValue}
        onClear={onClear}
        onNudge={onNudge}
        onOpenAutocompleteChange={onOpenAutocompleteChange}
        onUpdateField={onUpdateField}
        onUpdateLocation={onUpdateLocation}
        onUpdateMake={onUpdateMake}
      />
    </div>
  );
}
