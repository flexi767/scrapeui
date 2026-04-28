import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { replaceJoinRows } from '@/lib/api/db-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const articleId = Number(id);
  const body = await request.json();
  const now = new Date().toISOString();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (body.title) { updates.push('title = ?'); values.push(body.title.trim()); }
  if (body.content) { updates.push('body = ?'); values.push(body.content); }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now);
    raw.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...values, articleId);
  }

  replaceJoinRows(raw, 'article_labels', 'article_id', 'label_id', articleId, body.labelIds);
  replaceJoinRows(raw, 'article_listings', 'article_id', 'listing_id', articleId, body.listingIds);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  raw.prepare('DELETE FROM articles WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
