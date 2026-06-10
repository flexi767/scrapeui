import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireDealerScope } from '@/lib/api/auth-helpers';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import { refreshImageCount, normalizeImageOrder, STORAGE_IMAGE_ROOT } from '../image-helpers';

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

  const owner = raw.prepare(
    'SELECT b.dealer_id FROM mobilebg_backup_images i JOIN mobilebg_backups b ON b.id = i.backup_id WHERE i.id = ? AND i.backup_id = ? LIMIT 1'
  ).get(imageId, backupId) as { dealer_id: number } | undefined;
  if (!owner) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
  const check = await requireDealerScope(owner.dealer_id);
  if ('error' in check) return check.error;

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
