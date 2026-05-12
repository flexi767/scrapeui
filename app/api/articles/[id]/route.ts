import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { parsePositiveIntParam, replaceJoinRows, runMappedUpdate } from '@/lib/api/db-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const articleId = parsePositiveIntParam(id);
  if (!articleId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  const toUpdate: Record<string, unknown> = {};
  if (body.title) toUpdate.title = (body.title as string).trim();
  if (body.content) toUpdate.content = body.content;

  runMappedUpdate(raw, 'articles', 'id', articleId, toUpdate, { title: 'title', content: 'body' }, { updated_at: now });

  replaceJoinRows(raw, 'article_labels', 'article_id', 'label_id', articleId, body.labelIds);
  replaceJoinRows(raw, 'article_listings', 'article_id', 'listing_id', articleId, body.listingIds);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const articleId = parsePositiveIntParam(id);
  if (!articleId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  raw.prepare('DELETE FROM articles WHERE id = ?').run(articleId);
  return NextResponse.json({ ok: true });
}
