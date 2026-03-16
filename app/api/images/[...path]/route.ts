import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const BASE_DIR = '/Users/v/dev/scraped/carimg';

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
  const filePath = path.join(BASE_DIR, ...segments);

  // Security: ensure path stays within BASE_DIR
  if (!filePath.startsWith(BASE_DIR + path.sep) && filePath !== BASE_DIR) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response('Not found', { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  const file = fs.readFileSync(filePath);
  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
