import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';

const STORAGE_IMAGE_ROOT = path.join(process.cwd(), 'storage', 'mobilebg-backups');

function refreshImageCount(backupId: number): void {
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
    .run(backupId, new Date().toISOString(), backupId);
}

function normalizeImageOrder(backupId: number): void {
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

function maybeDeleteStoredFile(localPath: string): void {
  const resolved = path.resolve(localPath);
  const allowedRoot = path.resolve(STORAGE_IMAGE_ROOT);
  if (!resolved.startsWith(allowedRoot + path.sep)) return;
  try {
    fs.unlinkSync(resolved);
  } catch {
    // The DB row is the source of truth; a missing file should not block removal.
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ backupId: string; imageId: string }> },
) {
  const { backupId: backupIdParam, imageId: imageIdParam } = await params;
  const backupId = parsePositiveIntParam(backupIdParam);
  const imageId = parsePositiveIntParam(imageIdParam);
  if (!backupId || !imageId) {
    return NextResponse.json({ error: 'Invalid image or backup ID' }, { status: 400 });
  }

  const image = raw
    .prepare(
      `
      SELECT id, local_path
      FROM mobilebg_backup_images
      WHERE backup_id = ? AND id = ?
      LIMIT 1
    `,
    )
    .get(backupId, imageId) as { id: number; local_path: string } | undefined;

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }

  raw.prepare('DELETE FROM mobilebg_backup_images WHERE backup_id = ? AND id = ?').run(
    backupId,
    imageId,
  );
  normalizeImageOrder(backupId);
  refreshImageCount(backupId);
  maybeDeleteStoredFile(image.local_path);

  return NextResponse.json({ ok: true });
}
