#!/usr/bin/env tsx
/**
 * Facebook Marketplace publisher runner for scrapeui.
 *
 * Usage: tsx scraper/scripts/run-facebook-marketplace.ts --backup-id <id>
 */

import { openDb } from "@/scraper/lib/runner";
import { buildMarketplaceListingPayloads } from "@/lib/facebook-marketplace/listing-payload";
import { postToFacebookMarketplace } from "../../facebook-marketplace";

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

async function main() {
  const db = openDb();

  const listing = buildMarketplaceListingPayloads(db, [backupId], { skipPhotos })[0] ?? null;
  if (!listing) {
    console.error(`No backup found with id ${backupId}`);
    db.close();
    process.exit(1);
  }
  db.close();

  console.log(`Publishing backup #${backupId}: ${listing.title}`);
  console.log(`  Make: ${listing.make}, Model: ${listing.model}, Year: ${listing.year}, Mileage: ${listing.mileage}, Fuel: ${listing.fuel}, Color: ${listing.color}`);
  console.log(`  Type: ${listing.bodyType}, Transmission: ${listing.transmission}`);
  console.log(`  Location: ${listing.location ?? "(none)"}, Price: ${listing.price}, Photos: ${listing.photos.length}${skipPhotos ? " (skipped)" : ""}`);

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
