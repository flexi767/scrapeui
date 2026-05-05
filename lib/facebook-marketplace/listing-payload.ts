import Database from "better-sqlite3";

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
  local_path: string;
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

function getLocation(db: Database.Database, backupId: number): string | undefined {
  const snapshot = db
    .prepare(
      `SELECT fields_json
       FROM mobilebg_edit_form_snapshots
       WHERE backup_id = ?
       ORDER BY id DESC
       LIMIT 1`,
    )
    .get(backupId) as { fields_json: string } | undefined;

  if (!snapshot?.fields_json) return undefined;

  try {
    const fields = JSON.parse(snapshot.fields_json) as Array<{ name?: string; value?: string }>;
    const city = fields.find((field) => field.name === "f19")?.value?.trim();
    return city ? city.replace(/^(гр\.|с\.|общ\.)\s*/i, "").trim() : undefined;
  } catch {
    return undefined;
  }
}

export function buildMarketplaceListingPayload(
  db: Database.Database,
  backupId: number,
  options: { skipPhotos?: boolean; origin?: string } = {},
): MarketplaceListingPayload | null {
  const backup = db
    .prepare(
      `SELECT
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
       WHERE b.id = ?`,
    )
    .get(backupId) as BackupRow | undefined;

  if (!backup) return null;

  const images = db
    .prepare(
      `SELECT id, local_path
       FROM mobilebg_backup_images
       WHERE backup_id = ?
       ORDER BY sort_order ASC, id ASC`,
    )
    .all(backupId) as BackupImageRow[];

  const title = [backup.make, backup.model, backup.title].filter(Boolean).join(" ");
  const photoUrls = options.skipPhotos
    ? []
    : images.map((image) => {
        const path = `/api/mobilebg-backup-images/${image.id}`;
        return options.origin ? new URL(path, options.origin).toString() : path;
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
    location: getLocation(db, backupId),
    photos: options.skipPhotos ? [] : images.map((image) => image.local_path).filter(Boolean),
    photoUrls,
  };
}

