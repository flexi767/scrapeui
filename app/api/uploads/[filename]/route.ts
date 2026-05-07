import { NextRequest } from 'next/server';
import path from 'path';
import { isPathInside, streamFileResponse } from '@/lib/file-response';
import { UPLOADS_DIR } from '@/lib/storage-paths';

const UPLOAD_DIR = UPLOADS_DIR;

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const filePath = path.resolve(UPLOAD_DIR, filename);

  // Security: ensure path stays within UPLOAD_DIR
  if (!isPathInside(UPLOAD_DIR, filePath)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';

  return streamFileResponse(filePath, {
    contentType,
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
