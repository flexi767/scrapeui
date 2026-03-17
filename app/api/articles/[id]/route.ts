import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

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

  if (body.labelIds) {
    raw.prepare('DELETE FROM article_labels WHERE article_id = ?').run(articleId);
    const link = raw.prepare('INSERT INTO article_labels (article_id, label_id) VALUES (?, ?)');
    for (const lid of body.labelIds) link.run(articleId, lid);
  }

  if (body.listingIds) {
    raw.prepare('DELETE FROM article_listings WHERE article_id = ?').run(articleId);
    const link = raw.prepare('INSERT INTO article_listings (article_id, listing_id) VALUES (?, ?)');
    for (const lid of body.listingIds) link.run(articleId, lid);
  }

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
