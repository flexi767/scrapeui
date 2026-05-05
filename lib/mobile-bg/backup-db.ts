import type Database from "better-sqlite3";
import type { ExistingBackupRow, SavedImage, ScrapedDetail } from "@/lib/mobile-bg/backup-types";

export function createBackupRun(
  db: Database.Database,
  dealerId: number,
  sourceUrl: string,
): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
    INSERT INTO mobilebg_backup_runs (dealer_id, status, source_url, listings_count, images_count, started_at, created_at, updated_at)
    VALUES (?, 'running', ?, 0, 0, ?, ?, ?)
  `,
    )
    .run(dealerId, sourceUrl, now, now, now);
  return Number(result.lastInsertRowid);
}

export function clearBackupImages(db: Database.Database, backupId: number): void {
  db.prepare(`DELETE FROM mobilebg_backup_images WHERE backup_id = ?`).run(backupId);
}

export function deleteDuplicateBackups(
  db: Database.Database,
  canonicalId: number,
  duplicateIds: number[],
): void {
  if (duplicateIds.length === 0) return;

  const placeholders = duplicateIds.map(() => "?").join(", ");
  db.prepare(
    `UPDATE mobilebg_edit_form_snapshots SET backup_id = ? WHERE backup_id IN (${placeholders})`,
  ).run(canonicalId, ...duplicateIds);
  db.prepare(
    `UPDATE mobilebg_repost_jobs SET backup_id = ? WHERE backup_id IN (${placeholders})`,
  ).run(canonicalId, ...duplicateIds);
  db.prepare(
    `DELETE FROM mobilebg_backup_images WHERE backup_id IN (${placeholders})`,
  ).run(...duplicateIds);
  db.prepare(`DELETE FROM mobilebg_backups WHERE id IN (${placeholders})`).run(...duplicateIds);
}

export function dedupeMobileBgBackups(db: Database.Database, dealerId?: number): number {
  const duplicateGroups = db
    .prepare(
      `
    SELECT dealer_id, mobile_id
    FROM mobilebg_backups
    ${dealerId == null ? "" : "WHERE dealer_id = ?"}
    GROUP BY dealer_id, mobile_id
    HAVING COUNT(*) > 1
  `,
    )
    .all(...(dealerId == null ? [] : [dealerId])) as Array<{
    dealer_id: number;
    mobile_id: string;
  }>;

  let deletedCount = 0;

  for (const group of duplicateGroups) {
    const rows = db
      .prepare(
        `
      SELECT id
      FROM mobilebg_backups
      WHERE dealer_id = ? AND mobile_id = ?
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    `,
      )
      .all(group.dealer_id, group.mobile_id) as ExistingBackupRow[];

    const canonical = rows[0];
    const duplicateIds = rows.slice(1).map((row) => row.id);
    if (!canonical || duplicateIds.length === 0) continue;

    deleteDuplicateBackups(db, canonical.id, duplicateIds);
    deletedCount += duplicateIds.length;
  }

  return deletedCount;
}

export function upsertBackupArtifact(
  db: Database.Database,
  runId: number,
  dealerId: number,
  detail: ScrapedDetail,
): { backupId: number; action: "created" | "updated" } {
  const now = new Date().toISOString();
  const listingRow = db
    .prepare(
      `
    SELECT id, ad_status, kaparo, carsbg_created_date
    FROM listings
    WHERE mobile_id = ?
    LIMIT 1
  `,
    )
    .get(detail.mobileId) as
    | {
        id?: number;
        ad_status?: string | null;
        kaparo?: number | null;
        carsbg_created_date?: string | null;
      }
    | undefined;
  const existing = db
    .prepare(
      `
    SELECT id
    FROM mobilebg_backups
    WHERE dealer_id = ? AND mobile_id = ?
    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
  `,
    )
    .all(dealerId, detail.mobileId) as ExistingBackupRow[];

  const canonical = existing[0];
  const duplicateIds = existing.slice(1).map((row) => row.id);
  const normalizedColor = detail.color
    ? detail.color.split(/\r?\n/)[0].trim() || null
    : null;

  if (canonical) {
    if (duplicateIds.length > 0) {
      deleteDuplicateBackups(db, canonical.id, duplicateIds);
    }

    db.prepare(
      `
      UPDATE mobilebg_backups
      SET
        run_id = ?, listing_id = ?, source_url = ?, source_title = ?, phones_json = ?, extras_json = ?, tech_data_json = ?,
        photo_order_json = ?, image_count = 0, created_at = COALESCE(?, created_at), updated_at = ?
      WHERE id = ?
    `,
    ).run(
      runId,
      listingRow?.id ?? null,
      detail.url,
      detail.sourceTitle,
      JSON.stringify(detail.phones),
      JSON.stringify(detail.extras),
      JSON.stringify(detail.techData),
      JSON.stringify(detail.photoOrder),
      listingRow?.carsbg_created_date ?? null,
      now,
      canonical.id,
    );

    clearBackupImages(db, canonical.id);
    return { backupId: canonical.id, action: "updated" };
  }

  const createdAt = listingRow?.carsbg_created_date ?? now;

  const result = db
    .prepare(
      `
    INSERT INTO mobilebg_backups (
      run_id, dealer_id, listing_id, mobile_id, source_url, source_title, make, model, title,
      price_amount, price_currency, vat_included, year, mileage, fuel, power, engine, color, transmission, category,
      description, ad_status, kaparo, draft_needs_sync, last_mobile_sync_at,
      phones_json, extras_json, tech_data_json, photo_order_json, image_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      runId,
      dealerId,
      listingRow?.id ?? null,
      detail.mobileId,
      detail.url,
      detail.sourceTitle,
      detail.make,
      detail.model,
      detail.title,
      detail.priceAmount,
      detail.priceCurrency,
      detail.vat,
      detail.year,
      detail.mileage,
      detail.fuel,
      detail.power,
      detail.engine,
      normalizedColor,
      detail.transmission,
      detail.category,
      detail.description,
      listingRow?.ad_status ?? "none",
      listingRow?.kaparo ?? 0,
      0,
      null,
      JSON.stringify(detail.phones),
      JSON.stringify(detail.extras),
      JSON.stringify(detail.techData),
      JSON.stringify(detail.photoOrder),
      0,
      createdAt,
      now,
    );

  return { backupId: Number(result.lastInsertRowid), action: "created" };
}

export function insertBackupImages(
  db: Database.Database,
  backupId: number,
  savedImages: SavedImage[],
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO mobilebg_backup_images (backup_id, sort_order, filename, source_url, local_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < savedImages.length; i += 1) {
    const image = savedImages[i];
    stmt.run(backupId, i, image.filename, image.url, image.localPath, now);
  }

  db.prepare(
    `UPDATE mobilebg_backups SET image_count = ?, updated_at = ? WHERE id = ?`,
  ).run(savedImages.length, now, backupId);
}
