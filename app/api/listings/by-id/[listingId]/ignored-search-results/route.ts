import { NextResponse } from 'next/server';
import {
  addIgnoredSearchResult,
  listIgnoredSearchResults,
  removeIgnoredSearchResult,
} from '@/lib/mobile-bg/search-ignores';
import { parseIntParam } from '@/lib/api/db-helpers';

const parseListingId = parseIntParam;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const listingId = parseListingId((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  return NextResponse.json({
    rows: listIgnoredSearchResults(listingId),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const listingId = parseListingId((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null) as { ignoredMobileId?: string } | null;
  const ignoredMobileId = payload?.ignoredMobileId?.trim();
  if (!ignoredMobileId) {
    return NextResponse.json({ error: 'ignoredMobileId is required' }, { status: 400 });
  }

  addIgnoredSearchResult(listingId, ignoredMobileId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const listingId = parseListingId((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null) as { ignoredMobileId?: string } | null;
  const ignoredMobileId = payload?.ignoredMobileId?.trim();
  if (!ignoredMobileId) {
    return NextResponse.json({ error: 'ignoredMobileId is required' }, { status: 400 });
  }

  removeIgnoredSearchResult(listingId, ignoredMobileId);
  return NextResponse.json({ ok: true });
}
