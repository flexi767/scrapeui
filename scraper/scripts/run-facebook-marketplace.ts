#!/usr/bin/env tsx
/**
 * Facebook Marketplace publisher runner for scrapeui.
 *
 * Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id>
 *
 * Queries the backup DB for listing data and images, then opens a browser
 * pre-filled with the listing. The human clicks Publish.
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

async function main() {
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const db = new Database(
    process.env.DB_PATH ||
      path.resolve(__dirname, "../../../scraped/listings.db"),
  );
  db.pragma("journal_mode = WAL");

  const backup = db
    .prepare(
      `SELECT title, price_amount, description FROM mobilebg_backups WHERE id = ?`,
    )
    .get(backupId) as
    | {
        title: string | null;
        price_amount: number | null;
        description: string | null;
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

  db.close();

  const listing: MarketplaceListing = {
    title: backup.title ?? "",
    price: backup.price_amount ?? 0,
    description: backup.description ?? "",
    category: "vehicles",
    condition: "used_good",
    photos: images.map((img) => img.local_path).filter(Boolean),
  };

  const result = await postToFacebookMarketplace(listing);
  if (result.status === "error") {
    console.error("Facebook Marketplace error:", result.message);
    process.exit(1);
  }
  console.log("Done:", result.message);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
