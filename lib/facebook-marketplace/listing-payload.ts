import Database from "better-sqlite3";
import { appendSignedAssetToken } from "@/lib/signed-asset-token";
import { parseJson } from "@/lib/utils";

export interface MarketplaceListingPayload {
  backupId: number;
  title: string;
  price: number;
  description: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  color?: string;
  bodyType?: string;
  transmission?: string;
  condition?: string;
  noDamage?: boolean;
  vehicleType?: string;
  location?: string;
  photos: string[];
  photoUrls: string[];
}

interface BackupRow {
  id?: number;
  title: string | null;
  price_amount: number | null;
  description: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
}

interface BackupImageRow {
  id: number;
  backup_id?: number;
  local_path: string;
}

interface SnapshotRow {
  backup_id: number;
  fields_json: string | null;
}

function mapVehicleType(category: string | null): string {
  if (!category) return "Автомобил/камион";
  const c = category.toLowerCase();
  if (c.includes("мотоциклет") || c.includes("мото")) return "Мотоциклет";
  if (c.includes("каравана") || c.includes("кемпер")) return "Каравана/кемпер";
  if (c.includes("ремарке")) return "Ремарке";
  if (c.includes("лодка")) return "Лодка";
  if (c.includes("търговски") || c.includes("бус") || c.includes("ван")) return "Търговски/индустриални";
  return "Автомобил/камион";
}

function mapFuel(fuel: string | null): string | undefined {
  if (!fuel) return undefined;
  const f = fuel.toLowerCase();
  if (f.includes("дизел")) return "Дизел";
  if (f.includes("бензин")) return "Бензин";
  if (f.includes("хибрид") && f.includes("plug")) return "Plug-in хибрид";
  if (f.includes("хибрид")) return "Хибрид";
  if (f.includes("електр")) return "Електрически";
  if (f.includes("газ") || f.includes("lpg") || f.includes("lng")) return "Газ";
  return fuel;
}

function mapColor(color: string | null): string | undefined {
  if (!color) return undefined;
  const map: Record<string, string> = {
    "бял": "Бяло",
    "черен": "Черно",
    "сив": "Сиво",
    "червен": "Червено",
    "син": "Синьо",
    "зелен": "Зелено",
    "жълт": "Жълто",
    "оранжев": "Оранжево",
    "кафяв": "Кафяво",
    "бежов": "Бежово",
    "виолетов": "Виолетово",
    "златист": "Златисто",
    "сребрист": "Сребристо",
  };
  const c = color.toLowerCase();
  for (const [key, val] of Object.entries(map)) {
    if (c.includes(key)) return val;
  }
  return color;
}

function mapTransmission(transmission: string | null): string | undefined {
  if (!transmission) return undefined;
  const t = transmission.toLowerCase();
  if (t.includes("автомат")) return "Автоматична";
  if (t.includes("ръчна") || t.includes("механ")) return "Ръчна";
  return transmission;
}

function parseLocation(fieldsJson: string | null | undefined): string | undefined {
  const fields = parseJson<Array<{ name?: string; value?: string }>>(fieldsJson, []);
  const city = fields.find((field) => field.name === "f19")?.value?.trim();
  return city ? city.replace(/^(гр\.|с\.|общ\.)\s*/i, "").trim() : undefined;
}

function buildPayloadFromRows({
  backupId,
  backup,
  images,
  fieldsJson,
  options,
}: {
  backupId: number;
  backup: BackupRow;
  images: BackupImageRow[];
  fieldsJson?: string | null;
  options: { skipPhotos?: boolean; origin?: string; signedPhotoUrls?: boolean };
}): MarketplaceListingPayload {
  const title = [backup.make, backup.model, backup.title].filter(Boolean).join(" ");
  const photoUrls = options.skipPhotos
    ? []
    : images.map((image) => {
        const assetPath = options.signedPhotoUrls
          ? appendSignedAssetToken(`/api/mobilebg-backup-images/${image.id}`, image.id)
          : `/api/mobilebg-backup-images/${image.id}`;
        return options.origin ? new URL(assetPath, options.origin).toString() : assetPath;
      });

  return {
    backupId,
    title,
    price: backup.price_amount ?? 0,
    description: backup.description ?? "",
    make: backup.make ?? undefined,
    model: backup.model ?? undefined,
    year: backup.year ?? undefined,
    mileage: backup.mileage ?? undefined,
    fuel: mapFuel(backup.fuel),
    color: mapColor(backup.color),
    bodyType: backup.category ?? undefined,
    transmission: mapTransmission(backup.transmission),
    condition: "Отлично",
    noDamage: true,
    vehicleType: mapVehicleType(backup.category),
    location: parseLocation(fieldsJson),
    photos: options.skipPhotos ? [] : images.map((image) => image.local_path).filter(Boolean),
    photoUrls,
  };
}

export function buildMarketplaceListingPayloads(
  db: Database.Database,
  backupIds: number[],
  options: { skipPhotos?: boolean; origin?: string; signedPhotoUrls?: boolean } = {},
) {
  const uniqueIds = [...new Set(backupIds.filter(Number.isFinite))];
  if (uniqueIds.length === 0) return [];

  const placeholders = uniqueIds.map(() => "?").join(",");
  const backups = db
    .prepare(
      `SELECT
         b.id,
         b.title,
         b.price_amount,
         b.description,
         b.make,
         b.model,
         b.year,
         b.mileage,
         b.fuel,
         b.color,
         b.transmission,
         b.category
       FROM mobilebg_backups b
       WHERE b.id IN (${placeholders})`,
    )
    .all(...uniqueIds) as Array<BackupRow & { id: number }>;

  const images = options.skipPhotos
    ? []
    : (db
        .prepare(
          `SELECT id, backup_id, local_path
           FROM mobilebg_backup_images
           WHERE backup_id IN (${placeholders})
           ORDER BY backup_id ASC, sort_order ASC, id ASC`,
        )
        .all(...uniqueIds) as BackupImageRow[]);

  const snapshots = db
    .prepare(
      `WITH latest_snapshots AS (
         SELECT
           backup_id,
           fields_json,
           ROW_NUMBER() OVER (PARTITION BY backup_id ORDER BY id DESC) as row_num
         FROM mobilebg_edit_form_snapshots
         WHERE backup_id IN (${placeholders})
       )
       SELECT backup_id, fields_json
       FROM latest_snapshots
       WHERE row_num = 1`,
    )
    .all(...uniqueIds) as SnapshotRow[];

  const backupsById = new Map(backups.map((backup) => [backup.id, backup]));
  const imagesByBackupId = new Map<number, BackupImageRow[]>();
  for (const image of images) {
    if (!image.backup_id) continue;
    const existing = imagesByBackupId.get(image.backup_id) ?? [];
    existing.push(image);
    imagesByBackupId.set(image.backup_id, existing);
  }
  const snapshotByBackupId = new Map(
    snapshots.map((snapshot) => [snapshot.backup_id, snapshot.fields_json]),
  );

  return backupIds
    .map((backupId) => {
      const backup = backupsById.get(backupId);
      if (!backup) return null;
      return buildPayloadFromRows({
        backupId,
        backup,
        images: imagesByBackupId.get(backupId) ?? [],
        fieldsJson: snapshotByBackupId.get(backupId),
        options,
      });
    })
    .filter((payload): payload is MarketplaceListingPayload => Boolean(payload));
}
