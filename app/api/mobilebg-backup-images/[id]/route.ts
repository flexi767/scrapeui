import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { raw } from '@/db/client';
import { SCRAPED_ROOT } from '@/lib/storage-paths';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const ALLOWED_ROOTS = [
  SCRAPED_ROOT,
  path.join(process.cwd(), 'storage'),
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = raw.prepare(`
    SELECT local_path
    FROM mobilebg_backup_images
    WHERE id = ?
  `).get(Number(id)) as { local_path?: string } | undefined;

  const filePath = row?.local_path;
  if (!filePath) return new Response('Not found', { status: 404 });

  const resolved = path.resolve(filePath);
  const allowed = ALLOWED_ROOTS.some((root) => {
    const resolvedRoot = path.resolve(root);
    return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
  });
  if (!allowed) {
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
