import path from 'path';
import { NextRequest } from 'next/server';
import { raw } from '@/db/client';
import { isPathInside, streamFileResponse } from '@/lib/file-response';
import { SCRAPED_ROOT } from '@/lib/storage-paths';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const ALLOWED_ROOT = SCRAPED_ROOT;

export const runtime = 'nodejs';

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
  if (!isPathInside(ALLOWED_ROOT, resolved)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  return streamFileResponse(resolved, {
    contentType,
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
