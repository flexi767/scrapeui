import { NextResponse } from 'next/server';
import { getListingSearchPrefill } from '@/lib/mobile-bg/search-prefill';
import { parseIntParam } from '@/lib/api/db-helpers';
import { requireAuth } from '@/lib/api/auth-helpers';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const listingId = parseIntParam((await params).id);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const prefill = await getListingSearchPrefill(listingId);
  if (!prefill) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  return NextResponse.json(prefill);
}
