import { NextRequest, NextResponse } from 'next/server';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getArticles } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

export async function GET(request: NextRequest) {
  const check = await requireApiPagePermission('kb');
  if ('error' in check) return check.error;

  const sp = request.nextUrl.searchParams;
  const result = getArticles({
    search: sp.get('search') || undefined,
    labelId: sp.get('labelId') ? Number(sp.get('labelId')) : undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 50,
  });

  return NextResponse.json(result);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

export async function POST(request: NextRequest) {
  const check = await requireApiPagePermission('kb');
  if ('error' in check) return check.error;
  const session = check.session;

  const body = await request.json();
  const { title, content: articleBody, labelIds = [], listingIds = [] } = body;

  if (!title?.trim() || !articleBody) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  let slug = slugify(title);

  // Ensure unique slug
  const existing = raw.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${Date.now()}`;

  const result = runInsert(raw, 'articles', {
    title: title.trim(),
    slug,
    body: articleBody,
    author_id: Number(session.user.id),
    created_at: now,
    updated_at: now,
  });

  const articleId = result.lastInsertRowid as number;

  insertJoinRows(raw, 'article_labels', 'article_id', 'label_id', articleId, labelIds);
  insertJoinRows(raw, 'article_listings', 'article_id', 'listing_id', articleId, listingIds);
  logActivity(raw, 'article', articleId, 'created', null, Number(session.user.id), now);

  return NextResponse.json({ id: articleId, slug }, { status: 201 });
}
