import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import {
  deleteSearchProfile,
  getSavedSearchProfile,
  saveSearchProfile,
} from '@/lib/mobile-bg/search-profiles';
import { parseSearchFields } from '@/lib/mobile-bg/search-form-shared';
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
    profile: getSavedSearchProfile(listingId),
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

  const payload = await readJsonBody<{ fields?: unknown }>(request);
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
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const listingId = parseIntParam((await params).listingId);
  if (listingId == null) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  deleteSearchProfile(listingId);
  return NextResponse.json({ ok: true });
}
