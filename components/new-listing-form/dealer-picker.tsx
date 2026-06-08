'use client';

import { useTranslations } from "next-intl";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { formatPrice } from "@/lib/utils";

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
  const t = useTranslations('ui');
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
                    fallbackLabel={t('missing')}
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
