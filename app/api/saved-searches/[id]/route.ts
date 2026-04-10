import { NextResponse } from 'next/server';
import {
  getSavedSearchDetail,
  getSavedSearchRecord,
  listSavedSearchSummaries,
  updateSavedSearch,
} from '@/lib/mobile-bg/saved-searches';
import type { SearchField } from '@/lib/mobile-bg/search-form-shared';

function parseId(rawValue: string) {
  const id = Number.parseInt(rawValue, 10);
  return Number.isFinite(id) ? id : null;
}

function parseFields(payload: unknown): SearchField[] | null {
  if (!Array.isArray(payload)) return null;

  const fields: SearchField[] = [];
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
    fields.push({
      name: candidate.name,
      label: candidate.label,
      value: candidate.value,
      source:
        candidate.source === 'default' ||
        candidate.source === 'listing' ||
        candidate.source === 'derived' ||
        candidate.source === 'saved'
          ? candidate.source
          : 'saved',
    });
  }

  return fields;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid saved search id' }, { status: 400 });
  }

  const detail = await getSavedSearchDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
  }

  return NextResponse.json({ detail });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseId((await params).id);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid saved search id' }, { status: 400 });
  }

  if (!getSavedSearchRecord(id)) {
    return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
  }

  const payload = await request.json().catch(() => null) as { fields?: unknown } | null;
  const fields = parseFields(payload?.fields);
  if (!fields) {
    return NextResponse.json({ error: 'fields must be an array of search fields' }, { status: 400 });
  }

  updateSavedSearch(id, fields);
  const detail = await getSavedSearchDetail(id);
  if (!detail) {
    return NextResponse.json({ error: 'Saved search could not be reloaded' }, { status: 500 });
  }

  return NextResponse.json({
    detail,
    searches: listSavedSearchSummaries(),
  });
}
