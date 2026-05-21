import { NextResponse } from 'next/server';
import {
  deleteSavedSearch,
  getSavedSearchDetail,
  getSavedSearchRecord,
  listSavedSearchSummaries,
  updateSavedSearch,
} from '@/lib/mobile-bg/saved-searches';
import { parseSearchFields } from '@/lib/mobile-bg/search-form-shared';
import { parseIntParam } from '@/lib/api/db-helpers';
import { readJsonBody } from '@/lib/api/json-body';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseIntParam((await params).id);
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
  const id = parseIntParam((await params).id);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid saved search id' }, { status: 400 });
  }

  if (!getSavedSearchRecord(id)) {
    return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
  }

  const payload = await readJsonBody<{ fields?: unknown }>(request);
  const fields = parseSearchFields(payload?.fields);
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = parseIntParam((await params).id);
  if (id == null) {
    return NextResponse.json({ error: 'Invalid saved search id' }, { status: 400 });
  }

  if (!getSavedSearchRecord(id)) {
    return NextResponse.json({ error: 'Saved search not found' }, { status: 404 });
  }

  deleteSavedSearch(id);

  return NextResponse.json({
    searches: listSavedSearchSummaries(),
  });
}
