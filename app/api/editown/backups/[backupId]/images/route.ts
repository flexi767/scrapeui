import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { raw } from '@/db/client';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import { refreshImageCount, STORAGE_IMAGE_ROOT } from './image-helpers';
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MOBILEBG_IMAGE_WIDTH = 1600;
const MOBILEBG_IMAGE_HEIGHT = 1200;

interface ImageRow {
  id: number;
  backup_id: number;
  sort_order: number;
  filename: string;
  source_url: string | null;
  local_path: string;
  created_at: string | null;
}

const parseBackupId = parsePositiveIntParam;

function backupExists(backupId: number): boolean {
  const row = raw
    .prepare('SELECT id FROM mobilebg_backups WHERE id = ? LIMIT 1')
    .get(backupId) as { id: number } | undefined;
  return Boolean(row);
}

function listImages(backupId: number): ImageRow[] {
  return raw
    .prepare(
      `
      SELECT id, backup_id, sort_order, filename, source_url, local_path, created_at
      FROM mobilebg_backup_images
      WHERE backup_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    )
    .all(backupId) as ImageRow[];
}

function toPayload(row: ImageRow) {
  return {
    id: row.id,
    backupId: row.backup_id,
    sortOrder: row.sort_order,
    filename: row.filename,
    url: `/api/mobilebg-backup-images/${row.id}`,
    createdAt: row.created_at,
  };
}


async function resizeToMobileBgImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({
      width: MOBILEBG_IMAGE_WIDTH,
      height: MOBILEBG_IMAGE_HEIGHT,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .webp({ quality: 90 })
    .toBuffer();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = parseBackupId(backupIdParam);
  if (!backupId) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }
  if (!backupExists(backupId)) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  return NextResponse.json({ images: listImages(backupId).map(toPayload) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = parseBackupId(backupIdParam);
  if (!backupId) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }
  if (!backupExists(backupId)) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  const formData = await request.formData();
  const files = formData
    .getAll('images')
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No image files uploaded' }, { status: 400 });
  }

  const invalid = files.find((file) => !ALLOWED_MIME_TYPES.has(file.type));
  if (invalid) {
    return NextResponse.json(
      { error: `Unsupported image type: ${invalid.type || invalid.name}` },
      { status: 400 },
    );
  }

  const uploadDir = path.join(STORAGE_IMAGE_ROOT, String(backupId));
  fs.mkdirSync(uploadDir, { recursive: true });

  const maxSort = raw
    .prepare('SELECT MAX(sort_order) as max_sort FROM mobilebg_backup_images WHERE backup_id = ?')
    .get(backupId) as { max_sort: number | null } | undefined;
  let nextSort = (maxSort?.max_sort ?? -1) + 1;
  const now = new Date().toISOString();

  const insertImage = raw.prepare(`
    INSERT INTO mobilebg_backup_images (backup_id, sort_order, filename, source_url, local_path, created_at)
    VALUES (?, ?, ?, NULL, ?, ?)
  `);

  const insertedIds: number[] = [];
  for (const file of files) {
    const safeName = `${nextSort + 1}-${randomUUID()}.webp`;
    const localPath = path.join(uploadDir, safeName);
    const buffer = await resizeToMobileBgImage(Buffer.from(await file.arrayBuffer()));
    fs.writeFileSync(localPath, buffer);
    const result = insertImage.run(backupId, nextSort, file.name || safeName, localPath, now);
    insertedIds.push(Number(result.lastInsertRowid));
    nextSort += 1;
  }

  refreshImageCount(backupId);

  return NextResponse.json({
    images: listImages(backupId).map(toPayload),
    insertedIds,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = parseBackupId(backupIdParam);
  if (!backupId) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }
  if (!backupExists(backupId)) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  const payload = (await request.json().catch(() => null)) as { imageIds?: unknown } | null;
  const imageIds = payload?.imageIds;
  if (!Array.isArray(imageIds) || imageIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json({ error: 'imageIds must be an array of image IDs' }, { status: 400 });
  }

  const existingIds = listImages(backupId).map((image) => image.id);
  if (
    imageIds.length !== existingIds.length ||
    new Set(imageIds).size !== imageIds.length ||
    imageIds.some((id) => !existingIds.includes(id))
  ) {
    return NextResponse.json(
      { error: 'imageIds must include every image for this backup exactly once' },
      { status: 400 },
    );
  }

  const updateOrder = raw.transaction((ids: number[]) => {
    const stmt = raw.prepare(
      'UPDATE mobilebg_backup_images SET sort_order = ? WHERE backup_id = ? AND id = ?',
    );
    ids.forEach((id, index) => stmt.run(index, backupId, id));
  });
  updateOrder(imageIds as number[]);
  refreshImageCount(backupId);

  return NextResponse.json({ images: listImages(backupId).map(toPayload) });
}
