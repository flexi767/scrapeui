import { NextRequest } from 'next/server';
import path from 'path';
import { isPathInside, streamFileResponse } from '@/lib/file-response';
import { CARIMG_DIR } from '@/lib/storage-paths';

const BASE_DIR = CARIMG_DIR;

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filePath = path.resolve(BASE_DIR, ...segments);

  // Security: ensure path stays within BASE_DIR
  if (!isPathInside(BASE_DIR, filePath)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  return streamFileResponse(filePath, {
    contentType,
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
