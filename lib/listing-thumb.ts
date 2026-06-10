import {
  getPreferredListingThumbUrl,
  getCdnImageUrl,
  getLocalImageUrl,
  getThumbProxyUrl,
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

export interface ListingThumbParts {
  mobile_id?: string | null;
  first_thumb_key?: string | null;
  first_full_key?: string | null;
  image_cdn?: string | null;
  image_shard?: string | null;
  images_downloaded?: number | null;
  thumb_saved?: number | null;
  first_backup_image_id?: number | null;
}

function firstImageThumbUrl(row: ListingThumbParts): string | null {
  const firstKey = row.first_thumb_key || row.first_full_key;
  if (!firstKey) return null;

  if (firstKey.startsWith("http")) return firstKey;
  if (!row.mobile_id) return null;
  if (row.images_downloaded === 1) return getLocalImageUrl(row.mobile_id, "thumbs", 0);
  if (!row.image_cdn || !row.image_shard) return null;

  return getCdnImageUrl(
    row.mobile_id,
    firstKey,
    { cdn: row.image_cdn, shard: row.image_shard },
    "thumb",
  );
}

export function getListingThumbSrcFromParts(
  row: ListingThumbParts,
  options: ListingThumbOptions = {},
) {
  const remoteThumbUrl = firstImageThumbUrl(row);

  if (options.preferListingImage && remoteThumbUrl) {
    return row.mobile_id
      ? getThumbProxyUrl(row.mobile_id, remoteThumbUrl)
      : remoteThumbUrl;
  }

  if (row.first_backup_image_id) {
    return `/api/mobilebg-backup-images/${row.first_backup_image_id}`;
  }

  return getPreferredListingThumbUrl(
    row.mobile_id,
    remoteThumbUrl,
    row.thumb_saved,
  );
}

export function getListingThumbSrc(
  row: ListingThumbSource,
  options: ListingThumbOptions = {},
) {
  if (row.first_backup_image_id && !options.preferListingImage) {
    return `/api/mobilebg-backup-images/${row.first_backup_image_id}`;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
  const fullKeys = parseJson<string[]>(row.full_keys, []);
  const remoteThumbUrl = firstImageThumbUrl({
    mobile_id: row.mobile_id,
    first_thumb_key: thumbKeys[0],
    first_full_key: fullKeys[0],
    image_cdn: imageMeta?.cdn,
    image_shard: imageMeta?.shard,
    images_downloaded: row.images_downloaded,
  });

  if (options.preferListingImage && remoteThumbUrl) {
    return getPreferredListingThumbUrl(
      row.mobile_id,
      remoteThumbUrl,
      row.thumb_saved,
    );
  }

  return getPreferredListingThumbUrl(
    row.mobile_id,
    remoteThumbUrl,
    row.thumb_saved,
  );
}

export function getListingThumbAlt(
  listing: { make?: string | null; model?: string | null },
  suffix = "image",
) {
  return `${listing.make ?? "Listing"} ${listing.model ?? ""}`.trim() || `Listing ${suffix}`;
}
