import {
  ExternalLink,
  Loader2,
  Plus,
  Save,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { ListingThumbPreview } from "@/components/ListingThumbPreview";
import { Button } from "@/components/ui/button";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { formatMileage, formatPrice } from "@/lib/utils";

type SavedSearchListing = SearchPrefillData["listing"];

function getListingLabel(listing: SavedSearchListing) {
  if (!listing) return "";
  return [listing.make, listing.model].filter(Boolean).join(" ");
}

function getListingThumb(listing: SavedSearchListing) {
  if (!listing?.mobile_id) return null;
  return getListingThumbSrc({
    mobile_id: listing.mobile_id,
    thumb_keys: listing.thumbKeys,
    full_keys: listing.fullKeys,
    image_meta: listing.imageMeta,
    images_downloaded: listing.imagesDownloaded,
    thumb_saved: listing.thumbSaved,
  });
}

export function SavedSearchEditorHeader({
  listing,
  resultsLoading,
  saveAdMode,
  makeOrModelChanged,
  saveBusy,
  cloneBusy,
  deleteBusy,
  onShowFirst,
  onShowAll,
  onOpenMobileBg,
  onSaveAd,
  onSave,
  onSaveAsNew,
  onDelete,
}: {
  listing: SavedSearchListing;
  resultsLoading: boolean;
  saveAdMode: boolean;
  makeOrModelChanged: boolean;
  saveBusy: boolean;
  cloneBusy: boolean;
  deleteBusy: boolean;
  onShowFirst: () => void;
  onShowAll: () => void;
  onOpenMobileBg: () => void;
  onSaveAd: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
}) {
  const listingLabel = getListingLabel(listing);
  const thumbSrc = getListingThumb(listing);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
      {listing ? (
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            {listing.mobile_id && thumbSrc ? (
              <ListingThumbPreview
                src={thumbSrc}
                href={`/listings/${listing.mobile_id}`}
                alt={
                  `${listing.make ?? "Listing"} ${listing.model ?? ""}`.trim() ||
                  "Listing image"
                }
                widthClassName="w-24 shrink-0"
                previewWidthClassName="w-72"
                imageClassName="w-24 rounded object-contain"
              />
            ) : null}
            <div className="min-w-0">
              {listingLabel ? (
                <div className="text-sm font-medium text-white">
                  {listingLabel}
                </div>
              ) : null}
              <a
                href={listing.mobile_id ? `/listings/${listing.mobile_id}` : undefined}
                className="mt-1 block text-sm text-gray-300 hover:text-white"
              >
                {listing.title || "—"}
              </a>
              <div className="mt-1 text-xs text-gray-500">
                {formatPrice(listing.currentPrice)}
                {listing.power != null
                  ? ` • ${listing.power.toLocaleString("en-US")} PS`
                  : ""}{" "}
                • {listing.fuel || "—"} • {formatMileage(listing.mileage)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm font-medium text-gray-200">Search fields</div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onShowFirst}
          disabled={resultsLoading}
        >
          <SearchIcon className="mr-1 h-4 w-4" />
          First 7
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
          onClick={onShowAll}
          disabled={resultsLoading}
        >
          {resultsLoading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="mr-1 h-4 w-4" />
          )}
          All
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onOpenMobileBg}
        >
          <ExternalLink className="mr-1 h-4 w-4" />
          Open mobile.bg
        </Button>
        <Button
          type="button"
          variant="outline"
          className={
            saveAdMode
              ? "border-emerald-600 bg-emerald-900 text-white hover:bg-emerald-800"
              : "border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
          }
          onClick={onSaveAd}
          disabled={resultsLoading}
        >
          {resultsLoading && saveAdMode ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Save Ad
        </Button>
        {!makeOrModelChanged && (
          <Button
            type="button"
            variant="outline"
            className="border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
            onClick={onSave}
            disabled={saveBusy}
          >
            {saveBusy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1 h-4 w-4" />
            )}
            Save
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="border-amber-700 bg-amber-950/80 text-amber-200 hover:bg-amber-900 hover:text-white"
          onClick={onSaveAsNew}
          disabled={cloneBusy}
        >
          {cloneBusy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-1 h-4 w-4" />
          )}
          Save As New
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-red-700 bg-red-950/80 text-red-200 hover:bg-red-900 hover:text-white"
          onClick={onDelete}
          disabled={deleteBusy}
        >
          {deleteBusy ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-4 w-4" />
          )}
          Delete
        </Button>
      </div>
    </div>
  );
}
