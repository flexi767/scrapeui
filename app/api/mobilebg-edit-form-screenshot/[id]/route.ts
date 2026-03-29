import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { raw } from '@/db/client';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const ALLOWED_ROOT = '/Users/v/dev/scraped';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = raw.prepare(`
    SELECT screenshot_path
    FROM mobilebg_edit_form_snapshots
    WHERE id = ?
  `).get(Number(id)) as { screenshot_path?: string } | undefined;

  const filePath = row?.screenshot_path;
  if (!filePath) return new Response('Not found', { status: 404 });

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ALLOWED_ROOT + path.sep) && resolved !== ALLOWED_ROOT) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const file = fs.readFileSync(resolved);

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
