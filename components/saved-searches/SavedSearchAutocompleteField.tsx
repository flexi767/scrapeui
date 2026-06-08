'use client';

import { useTranslations } from "next-intl";
import {
  AutocompleteInput,
  type AutocompleteOption,
} from "@/components/new-listing-form/autocomplete";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import { formatCount } from "@/lib/utils";

export function SavedSearchAutocompleteField({
  field,
  kind,
  options,
  selectedCount,
  openAutocomplete,
  onOpenAutocompleteChange,
  onUpdateField,
  onUpdateMake,
}: {
  field: SearchField;
  kind: "marka" | "model";
  options: AutocompleteOption[];
  selectedCount: number | null;
  openAutocomplete: "marka" | "model" | null;
  onOpenAutocompleteChange: (
    updater:
      | "marka"
      | "model"
      | null
      | ((current: "marka" | "model" | null) => "marka" | "model" | null),
  ) => void;
  onUpdateField: (name: string, value: string) => void;
  onUpdateMake: (value: string) => void;
}) {
  const t = useTranslations('ui');
  const isMake = kind === "marka";

  return (
    <AutocompleteInput
      value={field.value}
      onChange={
        isMake ? onUpdateMake : (value) => onUpdateField(field.name, value)
      }
      options={options}
      placeholder={isMake ? "Type make" : "Type model"}
      emptyLabel={isMake ? t('no_make_matches') : t('no_model_matches')}
      hideLowCountOnEmpty={isMake}
      focusWhenOpen
      open={openAutocomplete === kind}
      onArrowLeft={isMake ? undefined : () => onOpenAutocompleteChange("marka")}
      trailingText={selectedCount != null ? formatCount(selectedCount) : null}
      onOpenChange={(open) => {
        if (open) {
          onOpenAutocompleteChange(kind);
          return;
        }
        onOpenAutocompleteChange((current) => (current === kind ? null : current));
      }}
    />
  );
}
