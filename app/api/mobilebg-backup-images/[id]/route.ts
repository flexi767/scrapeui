import path from 'path';
import { NextRequest } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import { isPathInside, streamFileResponse } from '@/lib/file-response';
import { verifySignedAssetToken } from '@/lib/signed-asset-token';
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

export const runtime = 'nodejs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const imageId = parsePositiveIntParam(id);
  if (!imageId) return new Response('Invalid ID', { status: 400 });
  const signed = verifySignedAssetToken(
    imageId,
    request.nextUrl.searchParams.get('t'),
  );
  if (!signed) {
    const check = await requireAuth();
    if ('error' in check) return check.error;
  }

  const row = raw.prepare(`
    SELECT local_path
    FROM mobilebg_backup_images
    WHERE id = ?
  `).get(imageId) as { local_path?: string } | undefined;

  const filePath = row?.local_path;
  if (!filePath) return new Response('Not found', { status: 404 });

  const resolved = path.resolve(filePath);
  const allowed = ALLOWED_ROOTS.some((root) => isPathInside(root, resolved));
  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  return streamFileResponse(resolved, {
    contentType,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      ...CORS_HEADERS,
    },
  });
}
