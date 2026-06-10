import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { toListingFtsQuery } from '@/lib/query-modules/listings/list-filters';
import { timedQuery } from '@/lib/query-modules/query-utils';

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
  const listingFtsQuery = toListingFtsQuery(q);
  const listingSearchSql = listingFtsQuery
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
  const params = listingFtsQuery
    ? [like, listingFtsQuery, like, like, like]
    : [like, like, like, like];

  const results = timedQuery('global.search', { hasListingFts: Boolean(listingFtsQuery) }, () => raw.prepare(`
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
        ${listingSearchSql}
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
  `).all(...params) as SearchResult[]);

  return NextResponse.json(results);
}
