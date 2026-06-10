import Database from "better-sqlite3";
import { formatMileage, formatPrice, parseJson } from "@/lib/utils";
import {
  buildBackupImageUrl,
  buildVehicleTitle,
  stripCityPrefix,
  type SharedPhotoOptions,
} from "@/lib/social/listing-payload-shared";

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
  city?: string;
  phone?: string;
  description: string;
  extras: string[];
  caption: string;
  photos: InstagramListingPhoto[];
}

interface BackupRow {
  listing_id: number | null;
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
  tech_data_json: string | null;
  phones_json: string | null;
  photo_order_json: string | null;
  thumb_keys: string | null;
  full_keys: string | null;
}

interface BackupImageRow {
  id: number;
  filename: string | null;
  source_url: string | null;
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
  const name = buildVehicleTitle(backup.make, backup.model, backup.title);
  const mileage = backup.mileage == null ? null : formatMileage(backup.mileage);
  const price = backup.price_amount == null ? null : formatPrice(backup.price_amount);
  const facts = [
    backup.year ? `Година: ${backup.year}` : null,
    mileage ? `Пробег: ${mileage}` : null,
    backup.fuel ? `Гориво: ${backup.fuel}` : null,
    backup.transmission ? `Скоростна кутия: ${backup.transmission}` : null,
    backup.power ? `Мощност: ${backup.power} к.с.` : null,
    price ? `Цена: ${price}` : null,
  ].filter(Boolean);
  const highlights = extras.slice(0, 8);

  return [
    name,
    "",
    ...facts,
    highlights.length ? "" : null,
    highlights.length ? `Екстри: ${highlights.join(", ")}` : null,
    backup.description ? "" : null,
    backup.description?.trim() || null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function parseStringArray(raw: string | null): string[] {
  const parsed = parseJson<unknown>(raw, []);
  return Array.isArray(parsed)
    ? parsed.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
}

function parseTechData(raw: string | null): Record<string, string> {
  const parsed = parseJson<unknown>(raw, {});
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
      key,
      String(value ?? "").trim(),
    ]),
  );
}

function cleanCity(city: string | undefined) {
  return city ? stripCityPrefix(city) || undefined : undefined;
}

function getPhotoKey(photo: BackupImageRow): string | null {
  const filenameKey = photo.filename?.replace(/\.[^.]+$/, "").trim();
  if (filenameKey) return filenameKey;
  const sourceKey = photo.source_url?.match(/_([^.]+)\.webp(?:$|\?)/)?.[1];
  return sourceKey ?? null;
}

function orderPhotos(photos: BackupImageRow[], backup: BackupRow): BackupImageRow[] {
  const preferredKeys = [
    ...parseStringArray(backup.photo_order_json),
    ...parseStringArray(backup.thumb_keys),
    ...parseStringArray(backup.full_keys),
  ];
  if (preferredKeys.length === 0) return photos;

  const order = new Map<string, number>();
  preferredKeys.forEach((key, index) => {
    if (!order.has(key)) order.set(key, index);
  });

  return [...photos].sort((a, b) => {
    const aKey = getPhotoKey(a);
    const bKey = getPhotoKey(b);
    const aOrder = aKey ? order.get(aKey) : undefined;
    const bOrder = bKey ? order.get(bKey) : undefined;
    if (aOrder != null && bOrder != null) return aOrder - bOrder;
    if (aOrder != null) return -1;
    if (bOrder != null) return 1;
    return photos.indexOf(a) - photos.indexOf(b);
  });
}

export function buildInstagramListingPayload(
  db: Database.Database,
  backupId: number,
  options: SharedPhotoOptions = {},
): InstagramListingPayload | null {
  const backup = db
    .prepare(
      `SELECT
         b.listing_id,
         b.title,
         b.price_amount,
         b.description,
         b.make,
         b.model,
         b.year,
         b.mileage,
         b.fuel,
         b.transmission,
         b.color,
         b.power,
         b.category,
         b.extras_json,
         b.tech_data_json,
         b.phones_json,
         b.photo_order_json,
         l.thumb_keys,
         l.full_keys
       FROM mobilebg_backups b
       LEFT JOIN listings l ON l.id = b.listing_id
       WHERE b.id = ?`,
    )
    .get(backupId) as BackupRow | undefined;

  if (!backup) return null;

  const photos = db
    .prepare(
      `SELECT id, filename, source_url
       FROM mobilebg_backup_images
       WHERE backup_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(backupId) as BackupImageRow[];

  const extras = parseExtras(backup.extras_json);
  const title = buildVehicleTitle(backup.make, backup.model, backup.title);
  const techData = parseTechData(backup.tech_data_json);
  const phones = parseStringArray(backup.phones_json);

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
    city: cleanCity(techData.city || techData.f19),
    phone: techData.f22 || phones[0] || undefined,
    description: backup.description ?? "",
    extras,
    caption: buildCaption(backup, extras),
    photos: orderPhotos(photos, backup).map((photo) => {
      return {
        id: photo.id,
        filename: photo.filename ?? `listing-${backupId}-${photo.id}.jpg`,
        url: buildBackupImageUrl(photo.id, options),
      };
    }),
  };
}
