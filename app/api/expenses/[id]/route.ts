import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getExpenseById } from '@/lib/queries';

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

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  const fieldMap: Record<string, string> = {
    title: 'title', amount: 'amount', currency: 'currency',
    date: 'date', category: 'category', notes: 'notes',
  };

  for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
    if (bodyKey in body) {
      updates.push(`${dbCol} = ?`);
      values.push(body[bodyKey] ?? null);
    }
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now);
    raw.prepare(`UPDATE expenses SET ${updates.join(', ')} WHERE id = ?`).run(...values, expenseId);
  }

  if (body.listingIds) {
    raw.prepare('DELETE FROM expense_listings WHERE expense_id = ?').run(expenseId);
    const link = raw.prepare('INSERT INTO expense_listings (expense_id, listing_id) VALUES (?, ?)');
    for (const lid of body.listingIds) link.run(expenseId, lid);
  }

  if (body.taskIds) {
    raw.prepare('DELETE FROM expense_tasks WHERE expense_id = ?').run(expenseId);
    const link = raw.prepare('INSERT INTO expense_tasks (expense_id, task_id) VALUES (?, ?)');
    for (const tid of body.taskIds) link.run(expenseId, tid);
  }

  if (body.labelIds) {
    raw.prepare('DELETE FROM expense_labels WHERE expense_id = ?').run(expenseId);
    const link = raw.prepare('INSERT INTO expense_labels (expense_id, label_id) VALUES (?, ?)');
    for (const lid of body.labelIds) link.run(expenseId, lid);
  }

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
