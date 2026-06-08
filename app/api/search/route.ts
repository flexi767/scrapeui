import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

export async function GET(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  const like = `%${q}%`;
  const results = raw.prepare(`
    SELECT type, id, title, subtitle, url
    FROM (
      SELECT 0 as group_order, 'task' as type, id, title,
        status || ' — ' || priority as subtitle,
        '/tasks/' || id as url
      FROM (
        SELECT id, title, status, priority
        FROM tasks
        WHERE title LIKE ?
        LIMIT 10
      )
      UNION ALL
      SELECT 1 as group_order, 'listing' as type, id,
        COALESCE(NULLIF(title, ''), TRIM(COALESCE(make, '') || ' ' || COALESCE(model, ''))) as title,
        COALESCE(mobile_id, '') as subtitle,
        '/listings/' || COALESCE(mobile_id, '') as url
      FROM (
        SELECT id, mobile_id, title, make, model
        FROM listings
        WHERE title LIKE ? OR make LIKE ? OR model LIKE ? OR mobile_id LIKE ?
        LIMIT 10
      )
      UNION ALL
      SELECT 2 as group_order, 'expense' as type, id, title,
        printf('%.2f', amount / 100.0) || ' ' || currency || ' — ' || category as subtitle,
        '/expenses/' || id as url
      FROM (
        SELECT id, title, amount, currency, category
        FROM expenses
        WHERE title LIKE ?
        LIMIT 10
      )
      UNION ALL
      SELECT 3 as group_order, 'article' as type, id, title,
        '' as subtitle,
        '/kb/' || slug as url
      FROM (
        SELECT id, title, slug
        FROM articles
        WHERE title LIKE ?
        LIMIT 10
      )
    )
    ORDER BY group_order
  `).all(like, like, like, like, like, like, like) as SearchResult[];

  return NextResponse.json(results);
}
