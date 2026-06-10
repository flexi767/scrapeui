import { appendSignedAssetToken } from "@/lib/signed-asset-token";

/** Options shared by both channel payload builders for photo URL construction. */
export interface SharedPhotoOptions {
  origin?: string;
  signedPhotoUrls?: boolean;
}

/**
 * Builds the full URL for a mobilebg backup image asset.
 * Applies a signed token when requested, and resolves against an origin when provided.
 */
export function buildBackupImageUrl(
  imageId: number,
  options: SharedPhotoOptions,
): string {
  const assetPath = options.signedPhotoUrls
    ? appendSignedAssetToken(`/api/mobilebg-backup-images/${imageId}`, imageId)
    : `/api/mobilebg-backup-images/${imageId}`;
  return options.origin ? new URL(assetPath, options.origin).toString() : assetPath;
}

/**
 * Strips Bulgarian city/village/municipality prefixes from a location string.
 * e.g. "гр. София" → "София", "с. Горна баня" → "Горна баня"
 */
export function stripCityPrefix(city: string): string {
  return city.replace(/^(гр\.|с\.|общ\.)\s*/i, "").trim();
}

/**
 * Builds a vehicle display title by joining make, model and title (variant/trim).
 * Falsy parts are omitted so partial data still produces a clean string.
 */
export function buildVehicleTitle(
  make: string | null | undefined,
  model: string | null | undefined,
  title: string | null | undefined,
): string {
  return [make, model, title].filter(Boolean).join(" ");
}
