#!/usr/bin/env tsx
/**
 * Facebook Marketplace publisher runner for scrapeui.
 *
 * Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id>
 */

import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import {
  postToFacebookMarketplace,
  type MarketplaceListing,
} from "../../facebook-marketplace";

const args = process.argv.slice(2);
const backupIdIdx = args.indexOf("--backup-id");
const backupId =
  backupIdIdx !== -1 ? parseInt(args[backupIdIdx + 1], 10) : NaN;

if (isNaN(backupId)) {
  console.error(
    "Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id>",
  );
  process.exit(1);
}

/** Map mobile.bg body category to FB Marketplace vehicle type option text. */
function mapVehicleType(category: string | null): string {
  if (!category) return "Автомобил/камион";
  const c = category.toLowerCase();
  if (c.includes("мотоциклет") || c.includes("мото")) return "Мотоциклет";
  if (c.includes("каравана") || c.includes("кемпер")) return "Каравана/кемпер";
  if (c.includes("ремарке")) return "Ремарке";
  if (c.includes("лодка")) return "Лодка";
  if (c.includes("търговски") || c.includes("бус") || c.includes("ван")) return "Търговски/индустриални";
  // Джип, Седан, Хечбек, Купе, Комби, Лифтбек, Миниван → Car/Truck
  return "Автомобил/камион";
}

async function main() {
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const db = new Database(
    process.env.DB_PATH ||
      path.resolve(__dirname, "../../../scraped/listings.db"),
  );
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
    transmission: backup.transmission ?? undefined,
    vehicleType: mapVehicleType(backup.category),
    location,
    photos: images.map((img) => img.local_path).filter(Boolean),
  };

  console.log(`Publishing backup #${backupId}: ${fullTitle}`);
  console.log(`  Make: ${backup.make}, Model: ${backup.model}, Year: ${backup.year}, Mileage: ${backup.mileage}`);
  console.log(`  Type: ${backup.category}, Transmission: ${backup.transmission}`);
  console.log(`  Location: ${location ?? "(none)"}, Price: ${backup.price_amount}, Photos: ${listing.photos.length}`);

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
