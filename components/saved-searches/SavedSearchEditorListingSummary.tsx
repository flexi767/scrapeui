import { ListingThumbPreview } from "@/components/ListingThumbPreview";
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

export function SavedSearchEditorListingSummary({
  listing,
}: {
  listing: SavedSearchListing;
}) {
  if (!listing) {
    return <div className="text-sm font-medium text-gray-200">Search fields</div>;
  }

  const listingLabel = getListingLabel(listing);
  const thumbSrc = getListingThumb(listing);

  return (
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
            <div className="text-sm font-medium text-white">{listingLabel}</div>
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
  );
}
