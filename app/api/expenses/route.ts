import { NextRequest, NextResponse } from 'next/server';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getExpenses } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

export async function GET(request: NextRequest) {
  const check = await requireApiPagePermission('expenses');
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
  const check = await requireApiPagePermission('expenses');
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

  const now = currentIsoTimestamp();
  const result = runInsert(raw, 'expenses', {
    title: title.trim(),
    amount,
    currency,
    date,
    category,
    notes: notes || null,
    created_by_id: Number(session.user.id),
    created_at: now,
    updated_at: now,
  });

  const expenseId = result.lastInsertRowid as number;

  insertJoinRows(raw, 'expense_listings', 'expense_id', 'listing_id', expenseId, listingIds);
  insertJoinRows(raw, 'expense_tasks', 'expense_id', 'task_id', expenseId, taskIds);
  insertJoinRows(raw, 'expense_labels', 'expense_id', 'label_id', expenseId, labelIds);
  logActivity(raw, 'expense', expenseId, 'created', null, Number(session.user.id), now);

  return NextResponse.json({ id: expenseId }, { status: 201 });
}
