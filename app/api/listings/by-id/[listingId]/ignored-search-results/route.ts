import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import {
  addIgnoredSearchResult,
  listIgnoredSearchResults,
  removeIgnoredSearchResult,
} from '@/lib/mobile-bg/search-ignores';
import { parseIntParam } from '@/lib/api/db-helpers';
import { readJsonBody } from '@/lib/api/json-body';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const listingId = parseIntParam((await params).listingId);
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
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const listingId = parseIntParam((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const payload = await readJsonBody<{ ignoredMobileId?: string }>(request);
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
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const listingId = parseIntParam((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const payload = await readJsonBody<{ ignoredMobileId?: string }>(request);
  const ignoredMobileId = payload?.ignoredMobileId?.trim();
  if (!ignoredMobileId) {
    return NextResponse.json({ error: 'ignoredMobileId is required' }, { status: 400 });
  }

  removeIgnoredSearchResult(listingId, ignoredMobileId);
  return NextResponse.json({ ok: true });
}
