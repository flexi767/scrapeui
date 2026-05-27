import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { currentIsoTimestamp } from '@/lib/date-format';
import {
  extractMobileId,
  parseReg,
  type ScrapedMobileBgListingInput,
} from '@/lib/mobile-bg/listing-persistence';
import { SCRAPED_ROOT } from '@/lib/storage-paths';

export interface MobileBgDraftDealer {
  id: number;
  slug: string;
}

export function seedMobileBgDraftBackup(
  db: Database.Database,
  dealer: MobileBgDraftDealer,
  listing: ScrapedMobileBgListingInput,
  listingDbId: number,
  make: string | null,
  model: string | null,
): number | null {
  const mobileId = extractMobileId(listing.url ?? '');
  if (!mobileId) return null;
  const now = currentIsoTimestamp();
  const { regYear } = parseReg(listing.year ?? null);
  const result = db
    .prepare(
      `
    INSERT OR IGNORE INTO mobilebg_backups
      (dealer_id, listing_id, mobile_id, source_url, title, make, model,
       price_amount, price_currency, description, year, mileage, fuel,
       transmission, color, category, extras_json, image_count,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      dealer.id,
      listingDbId,
      mobileId,
      listing.url,
      listing.title ?? null,
      make,
      model,
      listing.price?.amount ?? null,
      listing.price?.currency ?? 'EUR',
      listing.description ?? null,
      regYear ? parseInt(regYear, 10) : null,
      listing.mileage ?? null,
      listing.fuel ?? null,
      listing.transmission ?? null,
      listing.color ?? null,
      listing.bodyType ?? null,
      listing.extras ? JSON.stringify(listing.extras) : null,
      listing.imageCount ?? 0,
      now,
      now,
    );
  if (result.changes === 0) {
    const row = db
      .prepare('SELECT id FROM mobilebg_backups WHERE dealer_id = ? AND mobile_id = ? LIMIT 1')
      .get(dealer.id, mobileId) as { id: number } | undefined;
    return row?.id ?? null;
  }
  return result.lastInsertRowid as number;
}

export async function downloadMobileBgDraftImages(
  db: Database.Database,
  dealer: MobileBgDraftDealer,
  mobileId: string,
  backupId: number,
  fullUrls: string[],
): Promise<{ downloaded: number; failed: number }> {
  const dir = path.join(SCRAPED_ROOT, 'mobilebg-backups', dealer.slug, mobileId);
  fs.mkdirSync(dir, { recursive: true });

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < fullUrls.length; i++) {
    const srcUrl = fullUrls[i];
    const keyMatch = srcUrl.match(/[^/_]+_([^.]+)\.webp$/);
    const key = keyMatch?.[1] ?? `img_${i}`;
    const filename = `${key}.webp`;
    const localPath = path.join(dir, filename);

    if (fs.existsSync(localPath)) {
      downloaded++;
      continue;
    }

    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buf);

      db.prepare(
        `
      INSERT OR IGNORE INTO mobilebg_backup_images
        (backup_id, sort_order, filename, source_url, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      ).run(backupId, i, filename, srcUrl, localPath, currentIsoTimestamp());

      downloaded++;
    } catch {
      failed++;
    }
  }

  return { downloaded, failed };
}

