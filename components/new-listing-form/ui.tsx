import { formatPrice } from "@/lib/utils";
import type { FormState } from "./constants";
export {
  AutocompleteInput,
  getSelectedOptionCount,
  normalizeAutocompleteValue,
  sortMakeOptions,
  type AutocompleteOption,
} from "@/components/new-listing-form/autocomplete";
export {
  CheckboxField,
  FieldLabel,
  FormSection,
  InputField,
  SelectField,
} from "@/components/new-listing-form/fields";
export {
  DealerListingPicker,
  DealerSelector,
  type Dealer,
  type DealerListingSummary,
} from "@/components/new-listing-form/dealer-picker";

export function ExtrasColumn({
  category,
  items,
  selected,
  onToggle,
}: {
  category: string;
  items: readonly string[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{category}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-start gap-2 text-xs text-gray-300"
          >
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-0"
            />
            <span className="leading-tight">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function SavedListingSummary({
  form,
  mode,
  onEditDetails,
  onNewListing,
}: {
  form: FormState;
  mode: "created" | "updated";
  onEditDetails: () => void;
  onNewListing: () => void;
}) {
  const title = [form.make, form.model].filter(Boolean).join(" ") || "Обява";

  return (
    <section className="rounded-2xl border border-emerald-700/50 bg-emerald-950/25 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            {mode === "updated"
              ? "Промените са запазени."
              : "Черновата е запазена."}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
            {form.title ? (
              <span className="rounded-full bg-gray-900/70 px-2.5 py-1">
                {form.title}
              </span>
            ) : null}
            <span className="rounded-full bg-gray-900/70 px-2.5 py-1">
              {form.priceOnRequest ? "Цена при запитване" : formatPrice(Number(form.price) || null)}
            </span>
            {form.productionYear ? (
              <span className="rounded-full bg-gray-900/70 px-2.5 py-1">
                {form.productionYear}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onEditDetails}
            className="rounded-full border border-emerald-500/50 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:text-white"
          >
            Редактирай данните
          </button>
          <button
            type="button"
            onClick={onNewListing}
            className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:border-gray-500 hover:text-white"
          >
            Нова обява
          </button>
        </div>
      </div>
      <details className="mt-4 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-300">
          Покажи минимизираните полета
        </summary>
        <div className="mt-3 grid gap-2 text-sm text-gray-400 md:grid-cols-2 xl:grid-cols-4">
          <div>Двигател: {form.fuel || "—"}</div>
          <div>Скорости: {form.transmission || "—"}</div>
          <div>Пробег: {form.mileage || "—"}</div>
          <div>Цвят: {form.color || "—"}</div>
          <div>Регион: {form.region || "—"}</div>
          <div>Град: {form.city || "—"}</div>
          <div>VIN: {form.vin || "—"}</div>
          <div>Телефон: {form.phone || "—"}</div>
        </div>
      </details>
    </section>
  );
}
