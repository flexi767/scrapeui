import path from 'path';
import { raw } from '@/db/client';
import { currentIsoTimestamp } from '@/lib/date-format';

export const STORAGE_IMAGE_ROOT = path.join(process.cwd(), 'storage', 'mobilebg-backups');

export function refreshImageCount(backupId: number): void {
  raw
    .prepare(
      `
      UPDATE mobilebg_backups
      SET image_count = (
        SELECT COUNT(*) FROM mobilebg_backup_images WHERE backup_id = ?
      ),
      draft_needs_sync = CASE WHEN listing_id IS NULL THEN draft_needs_sync ELSE 1 END,
      last_mobile_sync_status = CASE WHEN listing_id IS NULL THEN last_mobile_sync_status ELSE 'pending' END,
      last_mobile_sync_error = CASE WHEN listing_id IS NULL THEN last_mobile_sync_error ELSE NULL END,
      updated_at = ?
      WHERE id = ?
    `,
    )
    .run(backupId, currentIsoTimestamp(), backupId);
}

export function normalizeImageOrder(backupId: number): void {
  const rows = raw
    .prepare(
      `
      SELECT id
      FROM mobilebg_backup_images
      WHERE backup_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    )
    .all(backupId) as { id: number }[];
  const stmt = raw.prepare(
    'UPDATE mobilebg_backup_images SET sort_order = ? WHERE backup_id = ? AND id = ?',
  );
  rows.forEach((row, index) => stmt.run(index, backupId, row.id));
}
