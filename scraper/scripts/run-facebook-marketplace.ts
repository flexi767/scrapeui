#!/usr/bin/env tsx
/**
 * Facebook Marketplace publisher runner for scrapeui.
 *
 * Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id>
 */

import Database from "better-sqlite3";
import { DB_PATH } from "@/scraper/lib/runner";
import {
  postToFacebookMarketplace,
  type MarketplaceListing,
} from "../../facebook-marketplace";

const args = process.argv.slice(2);
const backupIdIdx = args.indexOf("--backup-id");
const backupId =
  backupIdIdx !== -1 ? parseInt(args[backupIdIdx + 1], 10) : NaN;
const skipPhotos = args.includes("--no-photos");

if (isNaN(backupId)) {
  console.error(
    "Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id> [--no-photos]",
  );
  process.exit(1);
}

/** Map mobile.bg body category to FB "Тип превозно средство" option text. */
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

/** Map mobile.bg fuel string to FB "Тип гориво" option text. */
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

/** Map mobile.bg color to FB "Цвят" option text. */
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

/** Map mobile.bg transmission to FB option text. */
function mapTransmission(t: string | null): string | undefined {
  if (!t) return undefined;
  const l = t.toLowerCase();
  if (l.includes("автомат")) return "Автоматична";
  if (l.includes("ръчна") || l.includes("механ")) return "Ръчна";
  return t;
}

async function main() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

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
    .get(backupId) as
    | {
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
    | undefined;

  if (!backup) {
    console.error(`No backup found with id ${backupId}`);
    db.close();
    process.exit(1);
  }

  const images = db
    .prepare(
      `SELECT local_path FROM mobilebg_backup_images WHERE backup_id = ? ORDER BY sort_order ASC`,
    )
    .all(backupId) as { local_path: string }[];

  // Extract city from the edit form snapshot (field f19 = city, f18 = region)
  const snapshot = db
    .prepare(
      `SELECT fields_json FROM mobilebg_edit_form_snapshots WHERE backup_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(backupId) as { fields_json: string } | undefined;

  let location: string | undefined;
  if (snapshot?.fields_json) {
    try {
      const fields = JSON.parse(snapshot.fields_json) as Array<{ name?: string; value?: string }>;
      const cityField = fields.find((f) => f.name === "f19");
      const city = cityField?.value?.trim();
      if (city) {
        // "гр. Пловдив" → "Пловдив", "с. Марково" → "Марково"
        location = city.replace(/^(гр\.|с\.|общ\.)\s*/i, "").trim();
      }
    } catch { /* ignore parse errors */ }
  }

  db.close();

  // Construct title as "Make Model <listing title>"
  const titleParts = [backup.make, backup.model, backup.title].filter(Boolean);
  const fullTitle = titleParts.join(" ");

  const listing: MarketplaceListing = {
    title: fullTitle,
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
    location,
    photos: skipPhotos ? [] : images.map((img) => img.local_path).filter(Boolean),
  };

  console.log(`Publishing backup #${backupId}: ${fullTitle}`);
  console.log(`  Make: ${backup.make}, Model: ${backup.model}, Year: ${backup.year}, Mileage: ${backup.mileage}, Fuel: ${backup.fuel}, Color: ${backup.color}`);
  console.log(`  Type: ${backup.category}, Transmission: ${backup.transmission}`);
  console.log(`  Location: ${location ?? "(none)"}, Price: ${backup.price_amount}, Photos: ${listing.photos.length}${skipPhotos ? " (skipped)" : ""}`);

  const result = await postToFacebookMarketplace(listing);
  if (result.status === "error") {
    console.error("Facebook Marketplace error:", result.message);
  }
  console.log("Done:", result.message);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
