import { NextResponse } from 'next/server';
import { getListingSearchPrefill } from '@/lib/mobile-bg/search-prefill';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const listingId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const prefill = await getListingSearchPrefill(listingId);
  if (!prefill) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  return NextResponse.json(prefill);
}
