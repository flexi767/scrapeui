import {
  buildImageList,
  getPreferredListingThumbUrl,
  parseJson,
  type ImageMeta,
} from "@/lib/utils";

interface ListingThumbSource {
  mobile_id?: string | null;
  thumb_keys?: string | null;
  full_keys?: string | null;
  image_meta?: string | null;
  images_downloaded?: number | null;
  thumb_saved?: number | null;
  first_backup_image_id?: number | null;
}

interface ListingThumbOptions {
  preferListingImage?: boolean;
}

export function getListingThumbSrc(
  row: ListingThumbSource,
  options: ListingThumbOptions = {},
) {
  if (row.first_backup_image_id) {
    return `/api/mobilebg-backup-images/${row.first_backup_image_id}`;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
  const fullKeys = parseJson<string[]>(row.full_keys, []);
  const images = buildImageList(
    row.mobile_id ?? "",
    fullKeys.length ? fullKeys : thumbKeys,
    thumbKeys,
    imageMeta,
    row.images_downloaded === 1,
  );

  if (options.preferListingImage && images[0]?.thumb) {
    return images[0].thumb;
  }

  return getPreferredListingThumbUrl(
    row.mobile_id,
    images[0]?.thumb,
    row.thumb_saved,
  );
}

export function getListingThumbAlt(
  listing: { make?: string | null; model?: string | null },
  suffix = "image",
) {
  return `${listing.make ?? "Listing"} ${listing.model ?? ""}`.trim() || `Listing ${suffix}`;
}
