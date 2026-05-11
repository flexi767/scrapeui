import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getExpenses } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';

export async function GET(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

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
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const body = await request.json();
  const {
    title, amount, currency = 'EUR', date, category,
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

  insertJoinRows(raw, 'expense_listings', 'expense_id', 'listing_id', expenseId, listingIds);
  insertJoinRows(raw, 'expense_tasks', 'expense_id', 'task_id', expenseId, taskIds);
  insertJoinRows(raw, 'expense_labels', 'expense_id', 'label_id', expenseId, labelIds);
  logActivity(raw, 'expense', expenseId, 'created', null, Number(session.user.id), now);

  return NextResponse.json({ id: expenseId }, { status: 201 });
}
