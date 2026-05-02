import {
  normalizeAutocompleteValue,
  type AutocompleteOption,
} from "@/components/new-listing-form/autocomplete";
import type { FormState } from "@/components/new-listing-form/constants";
import type { MakeEntry } from "@/lib/mobile-bg/makes-models";

export function validateListingForm(form: FormState): string {
  if (!form.dealerId) return "Изберете дилър.";
  if (!form.make) return "Изберете марка.";
  if (!form.priceOnRequest && !form.price) {
    return 'Въведете цена или маркирайте "Цена само при запитване".';
  }
  return "";
}

export function findSelectedMake(makes: MakeEntry[], make: string) {
  return (
    makes.find(
      (entry) =>
        normalizeAutocompleteValue(entry.make) ===
        normalizeAutocompleteValue(make),
    ) ?? null
  );
}

export function makeOptionsFromEntries(makes: MakeEntry[]): AutocompleteOption[] {
  return makes.map((entry) => ({
    value: entry.make,
    count: entry.count ?? null,
  }));
}

export function modelOptionsFromMake(make: MakeEntry | null): AutocompleteOption[] {
  return (make?.models ?? []).map((entry) => ({
    value: entry.label,
    count: entry.count ?? null,
  }));
}

export function applyMakeSelection(
  form: FormState,
  makes: MakeEntry[],
  value: string,
): FormState {
  const selectedEntry = findSelectedMake(makes, value);
  const validModels = (selectedEntry?.models ?? []).map((entry) =>
    normalizeAutocompleteValue(entry.label),
  );
  const nextModel =
    form.model && validModels.includes(normalizeAutocompleteValue(form.model))
      ? form.model
      : "";

  return { ...form, make: value, model: nextModel };
}

export function getDraftResponseId(
  response: { id?: unknown },
  fallbackId: number | null = null,
) {
  return typeof response.id === "number" ? response.id : fallbackId;
}
