import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getArticles } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

const CreateArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  labelIds: z.array(z.number().int()).optional().default([]),
  listingIds: z.array(z.number().int()).optional().default([]),
});

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

  const parsed = CreateArticleSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const now = currentIsoTimestamp();
  let slug = slugify(body.title);
  const labelIds = body.labelIds ?? [];
  const listingIds = body.listingIds ?? [];

  // Ensure unique slug (read done before transaction — single SELECT is safe outside)
  const existing = raw.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${Date.now()}`;

  let articleId!: number;
  const tx = raw.transaction(() => {
    const result = runInsert(raw, 'articles', {
      title: body.title.trim(),
      slug,
      body: body.content,
      author_id: Number(session.user.id),
      created_at: now,
      updated_at: now,
    });

    articleId = result.lastInsertRowid as number;

    insertJoinRows(raw, 'article_labels', 'article_id', 'label_id', articleId, labelIds);
    insertJoinRows(raw, 'article_listings', 'article_id', 'listing_id', articleId, listingIds);
    logActivity(raw, 'article', articleId, 'created', null, Number(session.user.id), now);
  });
  tx();

  return NextResponse.json({ id: articleId, slug }, { status: 201 });
}
