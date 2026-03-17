import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

const UPLOAD_DIR = '/Users/v/dev/scraped/uploads';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 400 });
  }

  const ext = path.extname(file.name) || '';
  const storedName = nanoid() + ext;
  const filePath = path.join(UPLOAD_DIR, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const entityType = formData.get('entityType') as string | null;
  const entityId = formData.get('entityId') as string | null;
  const now = new Date().toISOString();

  const result = raw
    .prepare(
      `INSERT INTO uploads (filename, stored_name, mime_type, size_bytes, entity_type, entity_id, uploaded_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      file.name,
      storedName,
      file.type || 'application/octet-stream',
      file.size,
      entityType || null,
      entityId ? Number(entityId) : null,
      Number(session.user.id),
      now,
    );

  return NextResponse.json({
    id: result.lastInsertRowid,
    storedName,
    filename: file.name,
    url: `/api/uploads/${storedName}`,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
