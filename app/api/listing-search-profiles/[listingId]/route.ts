import { NextResponse } from 'next/server';
import {
  deleteSearchProfile,
  getSavedSearchProfile,
  saveSearchProfile,
  type SavedSearchField,
} from '@/lib/mobile-bg/search-profiles';

function parseListingId(rawValue: string) {
  const listingId = Number.parseInt(rawValue, 10);
  return Number.isFinite(listingId) ? listingId : null;
}

function parseFields(payload: unknown): SavedSearchField[] | null {
  if (!Array.isArray(payload)) return null;

  const fields: SavedSearchField[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') return null;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.name !== 'string' ||
      typeof candidate.label !== 'string' ||
      typeof candidate.value !== 'string'
    ) {
      return null;
    }

    const source = candidate.source;
    fields.push({
      name: candidate.name,
      label: candidate.label,
      value: candidate.value,
      source: source === 'default' || source === 'listing' || source === 'derived' || source === 'saved'
        ? source
        : 'saved',
    });
  }

  return fields;
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
  const fields = parseFields(payload?.fields);
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
