import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { UPLOADS_DIR } from '@/lib/storage-paths';

const UPLOAD_DIR = UPLOADS_DIR;
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const formData = await request.formData();
  const files = [
    ...formData.getAll('files'),
    ...formData.getAll('file'),
  ].filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const tooLarge = files.find((file) => file.size > MAX_SIZE);
  if (tooLarge) {
    return NextResponse.json({ error: `${tooLarge.name} is too large (max 20MB)` }, { status: 400 });
  }

  const entityType = formData.get('entityType') as string | null;
  const entityId = formData.get('entityId') as string | null;
  const now = new Date().toISOString();
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const insertUpload = raw
    .prepare(
      `INSERT INTO uploads (filename, stored_name, mime_type, size_bytes, entity_type, entity_id, uploaded_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
  const uploads = [];

  for (const file of files) {
    const ext = path.extname(file.name) || '';
    const storedName = nanoid() + ext;
    const filePath = path.join(UPLOAD_DIR, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const result = insertUpload.run(
      file.name,
      storedName,
      file.type || 'application/octet-stream',
      file.size,
      entityType || null,
      entityId ? Number(entityId) : null,
      Number(session.user.id),
      now,
    );

    uploads.push({
      id: result.lastInsertRowid,
      storedName,
      filename: file.name,
      url: `/api/uploads/${storedName}`,
    });
  }

  return NextResponse.json({
    ...uploads[0],
    uploads,
  });
}

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const uploads = raw
    .prepare(
      `SELECT u.*, usr.name as uploaded_by_name
       FROM uploads u
       LEFT JOIN users usr ON usr.id = u.uploaded_by_id
       ORDER BY u.created_at DESC
       LIMIT 200`,
    )
    .all();

  return NextResponse.json(uploads);
}
