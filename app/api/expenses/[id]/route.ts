import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getExpenseById } from '@/lib/queries';
import { replaceJoinRows, runMappedUpdate } from '@/lib/api/db-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const expense = getExpenseById(Number(id));
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const expenseId = Number(id);
  const body = await request.json();
  const now = new Date().toISOString();

  const fieldMap: Record<string, string> = {
    title: 'title', amount: 'amount', currency: 'currency',
    date: 'date', category: 'category', notes: 'notes',
  };

  runMappedUpdate(raw, 'expenses', 'id', expenseId, body, fieldMap, { updated_at: now });
  replaceJoinRows(raw, 'expense_listings', 'expense_id', 'listing_id', expenseId, body.listingIds);
  replaceJoinRows(raw, 'expense_tasks', 'expense_id', 'task_id', expenseId, body.taskIds);
  replaceJoinRows(raw, 'expense_labels', 'expense_id', 'label_id', expenseId, body.labelIds);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  raw.prepare('DELETE FROM expenses WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
