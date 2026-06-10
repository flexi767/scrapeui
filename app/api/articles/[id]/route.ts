import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { parsePositiveIntParam, replaceJoinRows, runMappedUpdate } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { getArticleById } from '@/lib/queries';

const PatchArticleSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  labelIds: z.array(z.number().int()).optional(),
  listingIds: z.array(z.number().int()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const articleId = parsePositiveIntParam(id);
  if (!articleId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const article = getArticleById(articleId);
  if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(article);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const articleId = parsePositiveIntParam(id);
  if (!articleId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const parsed = PatchArticleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const now = currentIsoTimestamp();

  const toUpdate: Record<string, unknown> = {};
  if (body.title) toUpdate.title = body.title.trim();
  if (body.content) toUpdate.content = body.content;

  const tx = raw.transaction(() => {
    runMappedUpdate(raw, 'articles', 'id', articleId, toUpdate, { title: 'title', content: 'body' }, { updated_at: now });

    replaceJoinRows(raw, 'article_labels', 'article_id', 'label_id', articleId, body.labelIds);
    replaceJoinRows(raw, 'article_listings', 'article_id', 'listing_id', articleId, body.listingIds);
  });
  tx();

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
