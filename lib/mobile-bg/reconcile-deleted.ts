import type Database from 'better-sqlite3';

interface ReconcileDeletedResult {
  reactivatedCount: number;
  deletedCount: number;
}

export function reconcileDeletedMobileBgListings(
  db: Database.Database,
  dealerId: number,
  seenMobileIds: Iterable<string>,
  now = new Date().toISOString(),
): ReconcileDeletedResult {
  const uniqueSeen = Array.from(new Set(Array.from(seenMobileIds).filter(Boolean)));
  const reactivatedCount = uniqueSeen.length > 0
    ? (db.prepare(`
      SELECT COUNT(*) as count
      FROM listings
      WHERE dealer_id = ?
        AND source = 'm'
        AND is_active = 0
        AND mobile_id IN (${uniqueSeen.map(() => '?').join(',')})
    `).get(dealerId, ...uniqueSeen) as { count: number }).count
    : 0;

  if (uniqueSeen.length > 0) {
    const seenPlaceholders = uniqueSeen.map(() => '?').join(',');
    db.prepare(`
      UPDATE listings
      SET is_active = 1,
          deleted_at = NULL,
          last_seen_at = ?
      WHERE dealer_id = ?
        AND source = 'm'
        AND mobile_id IN (${seenPlaceholders})
    `).run(now, dealerId, ...uniqueSeen);
  }

  const activeRows = db.prepare(`
    SELECT id, mobile_id
    FROM listings
    WHERE dealer_id = ?
      AND source = 'm'
      AND is_active = 1
      AND mobile_id IS NOT NULL
  `).all(dealerId) as Array<{ id: number; mobile_id: string }>;

  const seenSet = new Set(uniqueSeen);
  const missingIds = activeRows
    .filter((row) => !seenSet.has(row.mobile_id))
    .map((row) => row.id);

  if (missingIds.length > 0) {
    const missingPlaceholders = missingIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE listings
      SET is_active = 0,
          deleted_at = ?
      WHERE id IN (${missingPlaceholders})
    `).run(now, ...missingIds);
  }

  return {
    reactivatedCount,
    deletedCount: missingIds.length,
  };
}
