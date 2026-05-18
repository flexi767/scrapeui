import Database from "better-sqlite3";
import { appendSignedAssetToken } from "@/lib/signed-asset-token";
import { formatMileage, formatPrice, parseJson } from "@/lib/utils";

export interface InstagramListingPhoto {
  id: number;
  url: string;
  filename: string;
}

export interface InstagramListingPayload {
  backupId: number;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  price?: number;
  fuel?: string;
  transmission?: string;
  color?: string;
  power?: number;
  bodyType?: string;
  description: string;
  extras: string[];
  caption: string;
  photos: InstagramListingPhoto[];
}

interface BackupRow {
  title: string | null;
  price_amount: number | null;
  description: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  transmission: string | null;
  color: string | null;
  power: number | null;
  category: string | null;
  extras_json: string | null;
}

interface BackupImageRow {
  id: number;
  filename: string | null;
}

function parseExtras(raw: string | null): string[] {
  const parsed = parseJson<unknown>(raw, []);
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "label" in item) {
          return String((item as { label?: unknown }).label ?? "");
        }
        if (item && typeof item === "object" && "name" in item) {
          return String((item as { name?: unknown }).name ?? "");
        }
        return "";
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key, value]) => (typeof value === "string" ? value : key))
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function buildCaption(backup: BackupRow, extras: string[]): string {
  const name = [backup.make, backup.model, backup.title].filter(Boolean).join(" ");
  const mileage = backup.mileage == null ? null : formatMileage(backup.mileage);
  const price = backup.price_amount == null ? null : formatPrice(backup.price_amount);
  const facts = [
    backup.year ? `Year: ${backup.year}` : null,
    mileage ? `Mileage: ${mileage}` : null,
    backup.fuel ? `Fuel: ${backup.fuel}` : null,
    backup.transmission ? `Transmission: ${backup.transmission}` : null,
    backup.power ? `Power: ${backup.power} hp` : null,
    price ? `Price: ${price}` : null,
  ].filter(Boolean);
  const highlights = extras.slice(0, 8);

  return [
    name,
    "",
    ...facts,
    highlights.length ? "" : null,
    highlights.length ? `Extras: ${highlights.join(", ")}` : null,
    backup.description ? "" : null,
    backup.description?.trim() || null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function buildInstagramListingPayload(
  db: Database.Database,
  backupId: number,
  options: { origin?: string; signedPhotoUrls?: boolean } = {},
): InstagramListingPayload | null {
  const backup = db
    .prepare(
      `SELECT
         title,
         price_amount,
         description,
         make,
         model,
         year,
         mileage,
         fuel,
         transmission,
         color,
         power,
         category,
         extras_json
       FROM mobilebg_backups
       WHERE id = ?`,
    )
    .get(backupId) as BackupRow | undefined;

  if (!backup) return null;

  const photos = db
    .prepare(
      `SELECT id, filename
       FROM mobilebg_backup_images
       WHERE backup_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(backupId) as BackupImageRow[];

  const extras = parseExtras(backup.extras_json);
  const title = [backup.make, backup.model, backup.title].filter(Boolean).join(" ");

  return {
    backupId,
    title,
    make: backup.make ?? undefined,
    model: backup.model ?? undefined,
    year: backup.year ?? undefined,
    mileage: backup.mileage ?? undefined,
    price: backup.price_amount ?? undefined,
    fuel: backup.fuel ?? undefined,
    transmission: backup.transmission ?? undefined,
    color: backup.color ?? undefined,
    power: backup.power ?? undefined,
    bodyType: backup.category ?? undefined,
    description: backup.description ?? "",
    extras,
    caption: buildCaption(backup, extras),
    photos: photos.map((photo) => {
      const assetPath = options.signedPhotoUrls
        ? appendSignedAssetToken(`/api/mobilebg-backup-images/${photo.id}`, photo.id)
        : `/api/mobilebg-backup-images/${photo.id}`;
      return {
        id: photo.id,
        filename: photo.filename ?? `listing-${backupId}-${photo.id}.jpg`,
        url: options.origin ? new URL(assetPath, options.origin).toString() : assetPath,
      };
    }),
  };
}
