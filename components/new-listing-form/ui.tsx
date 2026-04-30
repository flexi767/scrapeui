import { ImageWithFallback } from "@/components/ImageWithFallback";
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

export interface Dealer {
  id: number;
  slug: string;
  name: string;
}

export interface DealerListingSummary {
  mobileId: string;
  backupId: number | null;
  make: string;
  model: string;
  title: string;
  price: number | null;
  thumb: string | null;
}

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

export function DealerSelector({
  dealers,
  value,
  onChange,
}: {
  dealers: Dealer[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {dealers.map((dealer) => {
        const selected = value === String(dealer.id);
        return (
          <button
            key={dealer.id}
            type="button"
            onClick={() => onChange(selected ? "" : String(dealer.id))}
            aria-pressed={selected}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected
                ? "border-sky-500 bg-sky-500/15 text-sky-200"
                : "border-gray-700 bg-gray-900/80 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            {dealer.name}
          </button>
        );
      })}
    </div>
  );
}

export function DealerListingPicker({
  listings,
  loading,
  selectedMobileId,
  prefillingMobileId,
  deletingBackupId,
  error,
  onSelect,
  onRequestDeleteDraft,
}: {
  listings: DealerListingSummary[];
  loading: boolean;
  selectedMobileId: string | null;
  prefillingMobileId: string | null;
  deletingBackupId: number | null;
  error: string;
  onSelect: (mobileId: string, backupId: number | null) => void;
  onRequestDeleteDraft: (backupId: number) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-400">
        Зареждане на обявите...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-500">
        Няма активни обяви за този дилър.
      </div>
    );
  }

  return (
    <div>
      <div className="grid max-h-80 gap-2 overflow-y-auto pr-2.5 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => {
          const key = listing.mobileId || `b:${listing.backupId}`;
          const selected =
            selectedMobileId === (listing.mobileId || String(listing.backupId));
          const prefilling =
            prefillingMobileId ===
            (listing.mobileId || String(listing.backupId));
          const isDraft = !listing.mobileId && listing.backupId != null;
          const deleting = isDraft && deletingBackupId === listing.backupId;
          return (
            <div
              key={key}
              className={`flex w-full items-center gap-1 rounded-md border transition-colors ${
                selected
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-gray-700 bg-gray-900/80 hover:border-gray-500 hover:bg-gray-800/80"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(listing.mobileId, listing.backupId)}
                disabled={Boolean(prefillingMobileId) || deleting}
                className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
              >
                {listing.thumb ? (
                  <ImageWithFallback
                    src={listing.thumb}
                    alt={
                      `${listing.make} ${listing.model}`.trim() ||
                      "Listing image"
                    }
                    className="h-12 w-16 rounded object-contain"
                    style={{ aspectRatio: "4/3" }}
                    fallbackClassName="h-12 w-16 rounded bg-gray-800 text-gray-400"
                    fallbackLabel="Missing"
                  />
                ) : (
                  <div className="h-12 w-16 rounded bg-gray-800" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {[listing.make, listing.model].filter(Boolean).join(" ") ||
                      listing.mobileId ||
                      "Чернова"}
                  </div>
                  <div className="truncate text-xs text-gray-400">
                    {listing.title || "—"}
                  </div>
                  <div className="text-xs font-medium text-sky-300">
                    {prefilling ? "Зареждане..." : formatPrice(listing.price)}
                  </div>
                </div>
              </button>
              {isDraft ? (
                <button
                  type="button"
                  onClick={() =>
                    onRequestDeleteDraft(listing.backupId as number)
                  }
                  disabled={deleting || Boolean(prefillingMobileId)}
                  title="Изтрий черновата"
                  aria-label="Изтрий черновата"
                  className="mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-base leading-none text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? "..." : "×"}
                </button>
              ) : null}
            </div>
          );
        })}
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
