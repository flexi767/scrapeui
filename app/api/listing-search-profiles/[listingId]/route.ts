import { NextResponse } from 'next/server';
import {
  deleteSearchProfile,
  getSavedSearchProfile,
  saveSearchProfile,
} from '@/lib/mobile-bg/search-profiles';
import { parseSearchFields } from '@/lib/mobile-bg/search-form-shared';

function parseListingId(rawValue: string) {
  const listingId = Number.parseInt(rawValue, 10);
  return Number.isFinite(listingId) ? listingId : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const listingId = parseListingId((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  return NextResponse.json({
    profile: getSavedSearchProfile(listingId),
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

  const payload = await request.json().catch(() => null) as { fields?: unknown } | null;
  const fields = parseSearchFields(payload?.fields);
  if (!fields) {
    return NextResponse.json({ error: 'fields must be an array of search fields' }, { status: 400 });
  }

  const updatedAt = saveSearchProfile(listingId, fields);
  return NextResponse.json({ ok: true, updatedAt });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const listingId = parseListingId((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  deleteSearchProfile(listingId);
  return NextResponse.json({ ok: true });
}
