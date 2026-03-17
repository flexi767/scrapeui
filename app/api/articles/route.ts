import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getArticles } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, content: articleBody, labelIds = [], listingIds = [] } = body;

  if (!title?.trim() || !articleBody) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  let slug = slugify(title);

  // Ensure unique slug
  const existing = raw.prepare('SELECT id FROM articles WHERE slug = ?').get(slug);
  if (existing) slug = `${slug}-${Date.now()}`;

  const result = raw.prepare(`
    INSERT INTO articles (title, slug, body, author_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), slug, articleBody, Number(session.user.id), now, now);

  const articleId = result.lastInsertRowid as number;

  const linkLabel = raw.prepare('INSERT INTO article_labels (article_id, label_id) VALUES (?, ?)');
  for (const lid of labelIds) linkLabel.run(articleId, lid);

  const linkListing = raw.prepare('INSERT INTO article_listings (article_id, listing_id) VALUES (?, ?)');
  for (const lid of listingIds) linkListing.run(articleId, lid);

  raw.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
    VALUES ('article', ?, 'created', NULL, ?, ?)
  `).run(articleId, Number(session.user.id), now);

  return NextResponse.json({ id: articleId, slug }, { status: 201 });
}
