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

type SnapshotPayload = Omit<ListingSnapshotInput, 'recordedAt'>;
type SnapshotField = keyof SnapshotPayload;

export type ListingSnapshotChangeMap = Partial<{
  [K in SnapshotField]: {
    changed: boolean;
    previous: SnapshotPayload[K] | null | undefined;
  };
}>;

export function previousValueIfChanged<T>(
  changed: boolean,
  value: T | null | undefined,
): T | null {
  return changed ? value ?? null : null;
}

export function hasListingSnapshotPayload(snapshot: SnapshotPayload): boolean {
  return Object.values(snapshot).some((value) => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}

export function hasListingSnapshotChanges(changes: ListingSnapshotChangeMap): boolean {
  return Object.values(changes).some((change) => change?.changed);
}

export function buildListingSnapshotPayload(changes: ListingSnapshotChangeMap): SnapshotPayload {
  const snapshot: SnapshotPayload = {};

  for (const [field, change] of Object.entries(changes) as Array<[SnapshotField, ListingSnapshotChangeMap[SnapshotField]]>) {
    if (!change) continue;
    snapshot[field] = previousValueIfChanged(change.changed, change.previous) as never;
  }

  return snapshot;
}

export function getPriceChangeDelta({
  priceChanged,
  newPrice,
  oldPrice,
  existingPriceChange,
  missingOldPriceAsZero = false,
}: {
  priceChanged: boolean;
  newPrice: number | null;
  oldPrice: number | null;
  existingPriceChange: number | null;
  missingOldPriceAsZero?: boolean;
}): number | null {
  if (!priceChanged || newPrice == null) return existingPriceChange ?? null;
  if (oldPrice == null && !missingOldPriceAsZero) return existingPriceChange ?? null;
  return newPrice - (oldPrice ?? 0);
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
