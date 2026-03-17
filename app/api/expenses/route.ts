import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getExpenses } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const result = getExpenses({
    category: sp.get('category') || undefined,
    dateFrom: sp.get('dateFrom') || undefined,
    dateTo: sp.get('dateTo') || undefined,
    search: sp.get('search') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 50,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    title, amount, currency = 'BGN', date, category,
    notes, listingIds = [], taskIds = [], labelIds = [],
  } = body;

  if (!title?.trim() || amount == null || !date || !category) {
    return NextResponse.json({ error: 'Title, amount, date, and category are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = raw.prepare(`
    INSERT INTO expenses (title, amount, currency, date, category, notes, created_by_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), amount, currency, date, category, notes || null, Number(session.user.id), now, now);

  const expenseId = result.lastInsertRowid as number;

  const linkListing = raw.prepare('INSERT INTO expense_listings (expense_id, listing_id) VALUES (?, ?)');
  for (const lid of listingIds) linkListing.run(expenseId, lid);

  const linkTask = raw.prepare('INSERT INTO expense_tasks (expense_id, task_id) VALUES (?, ?)');
  for (const tid of taskIds) linkTask.run(expenseId, tid);

  const linkLabel = raw.prepare('INSERT INTO expense_labels (expense_id, label_id) VALUES (?, ?)');
  for (const lid of labelIds) linkLabel.run(expenseId, lid);

  raw.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
    VALUES ('expense', ?, 'created', NULL, ?, ?)
  `).run(expenseId, Number(session.user.id), now);

  return NextResponse.json({ id: expenseId }, { status: 201 });
}
