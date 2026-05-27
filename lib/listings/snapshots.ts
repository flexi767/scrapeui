import type Database from 'better-sqlite3';

export interface ListingSnapshotInput {
  price?: number | null;
  vat?: string | null;
  lastEdit?: string | null;
  views?: number | null;
  adStatus?: string | null;
  kaparo?: number | null;
  title?: string | null;
  description?: string | null;
  recordedAt: string;
}

export function insertListingSnapshot(
  db: Database.Database,
  listingId: number,
  snapshot: ListingSnapshotInput,
): void {
  db.prepare(`
    INSERT INTO listing_snapshots (
      listing_id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    listingId,
    snapshot.price ?? null,
    snapshot.vat ?? null,
    snapshot.lastEdit ?? null,
    snapshot.views ?? null,
    snapshot.adStatus ?? null,
    snapshot.kaparo ?? null,
    snapshot.title ?? null,
    snapshot.description ?? null,
    snapshot.recordedAt,
  );
}

