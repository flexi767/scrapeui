import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

interface SearchResult {
  type: string;
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  const like = `%${q}%`;
  const results: SearchResult[] = [];

  // Search tasks
  const tasks = raw.prepare(`
    SELECT id, title, status, priority FROM tasks
    WHERE title LIKE ? LIMIT 10
  `).all(like) as { id: number; title: string; status: string; priority: string }[];
  for (const t of tasks) {
    results.push({
      type: 'task', id: t.id, title: t.title,
      subtitle: `${t.status} — ${t.priority}`,
      url: `/tasks/${t.id}`,
    });
  }

  // Search listings
  const listings = raw.prepare(`
    SELECT id, mobile_id, title, make, model FROM listings
    WHERE title LIKE ? OR make LIKE ? OR model LIKE ? OR mobile_id LIKE ?
    LIMIT 10
  `).all(like, like, like, like) as { id: number; mobile_id: string; title: string; make: string; model: string }[];
  for (const l of listings) {
    results.push({
      type: 'listing', id: l.id, title: l.title || `${l.make} ${l.model}`,
      subtitle: l.mobile_id,
      url: `/listings/${l.mobile_id}`,
    });
  }

  // Search expenses
  const expenses = raw.prepare(`
    SELECT id, title, amount, currency, category FROM expenses
    WHERE title LIKE ? LIMIT 10
  `).all(like) as { id: number; title: string; amount: number; currency: string; category: string }[];
  for (const e of expenses) {
    results.push({
      type: 'expense', id: e.id, title: e.title,
      subtitle: `${(e.amount / 100).toFixed(2)} ${e.currency} — ${e.category}`,
      url: `/expenses/${e.id}`,
    });
  }

  // Search articles
  const articles = raw.prepare(`
    SELECT id, title, slug FROM articles
    WHERE title LIKE ? LIMIT 10
  `).all(like) as { id: number; title: string; slug: string }[];
  for (const a of articles) {
    results.push({
      type: 'article', id: a.id, title: a.title,
      subtitle: '',
      url: `/kb/${a.slug}`,
    });
  }

  return NextResponse.json(results);
}
