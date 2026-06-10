import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { toFtsPrefixQuery, timedQuery } from '@/lib/query-modules/query-utils';

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
  const ftsQuery = toFtsPrefixQuery(q);
  const listingSearchSql = ftsQuery
    ? `
      SELECT id, mobile_id, title, make, model
      FROM (
        SELECT listings.id, listings.mobile_id, listings.title, listings.make, listings.model
        FROM listings_search_fts fts
        JOIN listings ON listings.id = fts.rowid
        WHERE listings_search_fts MATCH ?
        UNION
        SELECT id, mobile_id, title, make, model
        FROM listings
        WHERE mobile_id LIKE ?
      )
      LIMIT 10
    `
    : `
      SELECT id, mobile_id, title, make, model
      FROM listings
      WHERE mobile_id LIKE ?
      LIMIT 10
    `;
  const params = ftsQuery
    ? [ftsQuery, ftsQuery, like, ftsQuery, ftsQuery]
    : [like, like, like, like];

  const results = timedQuery('global.search', { hasFts: Boolean(ftsQuery) }, () => raw.prepare(`
    SELECT type, id, title, subtitle, url
    FROM (
      SELECT 0 as group_order, 'task' as type, id, title,
        status || ' — ' || priority as subtitle,
        '/tasks/' || id as url
      FROM (
        SELECT tasks.id, tasks.title, tasks.status, tasks.priority
        FROM tasks
        ${ftsQuery ? `JOIN tasks_search_fts ON tasks_search_fts.rowid = tasks.id WHERE tasks_search_fts MATCH ?` : `WHERE title LIKE ?`}
        LIMIT 10
      )
      UNION ALL
      SELECT 1 as group_order, 'listing' as type, id,
        COALESCE(NULLIF(title, ''), TRIM(COALESCE(make, '') || ' ' || COALESCE(model, ''))) as title,
        COALESCE(mobile_id, '') as subtitle,
        '/listings/' || COALESCE(mobile_id, '') as url
      FROM (
        ${listingSearchSql}
      )
      UNION ALL
      SELECT 2 as group_order, 'expense' as type, id, title,
        printf('%.2f', amount / 100.0) || ' ' || currency || ' — ' || category as subtitle,
        '/expenses/' || id as url
      FROM (
        SELECT expenses.id, expenses.title, expenses.amount, expenses.currency, expenses.category
        FROM expenses
        ${ftsQuery ? `JOIN expenses_search_fts ON expenses_search_fts.rowid = expenses.id WHERE expenses_search_fts MATCH ?` : `WHERE title LIKE ?`}
        LIMIT 10
      )
      UNION ALL
      SELECT 3 as group_order, 'article' as type, id, title,
        '' as subtitle,
        '/kb/' || slug as url
      FROM (
        SELECT articles.id, articles.title, articles.slug
        FROM articles
        ${ftsQuery ? `JOIN articles_search_fts ON articles_search_fts.rowid = articles.id WHERE articles_search_fts MATCH ?` : `WHERE title LIKE ?`}
        LIMIT 10
      )
    )
    ORDER BY group_order
  `).all(...params) as SearchResult[]);

  return NextResponse.json(results);
}
