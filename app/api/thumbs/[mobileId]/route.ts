import fsp from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { findSavedListingThumbPath, getContentTypeForThumbPath } from '@/lib/listing-thumbs';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mobileId: string }> },
) {
  const mobileId = decodeURIComponent((await params).mobileId);
  const localPath = await findSavedListingThumbPath(mobileId);

  if (localPath) {
    const bytes = await fsp.readFile(localPath);
    return new Response(bytes, {
      headers: {
        'Content-Type': getContentTypeForThumbPath(localPath),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const fallback = req.nextUrl.searchParams.get('fallback');
  if (fallback) {
    return NextResponse.redirect(fallback);
  }

  return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
}
