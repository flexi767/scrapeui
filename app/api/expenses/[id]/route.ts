import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getExpenseById } from '@/lib/queries';
import { parsePositiveIntParam, replaceJoinRows, runMappedUpdate } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';

const PatchExpenseSchema = z.object({
  title: z.string().min(1).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional().nullable(),
  listingIds: z.array(z.number().int()).optional(),
  taskIds: z.array(z.number().int()).optional(),
  labelIds: z.array(z.number().int()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const expenseId = parsePositiveIntParam(id);
  if (!expenseId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const expense = getExpenseById(expenseId);
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(expense);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const expenseId = parsePositiveIntParam(id);
  if (!expenseId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const parsed = PatchExpenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const now = currentIsoTimestamp();

  const fieldMap: Record<string, string> = {
    title: 'title', amount: 'amount', currency: 'currency',
    date: 'date', category: 'category', notes: 'notes',
  };

  const tx = raw.transaction(() => {
    runMappedUpdate(raw, 'expenses', 'id', expenseId, body, fieldMap, { updated_at: now });
    replaceJoinRows(raw, 'expense_listings', 'expense_id', 'listing_id', expenseId, body.listingIds);
    replaceJoinRows(raw, 'expense_tasks', 'expense_id', 'task_id', expenseId, body.taskIds);
    replaceJoinRows(raw, 'expense_labels', 'expense_id', 'label_id', expenseId, body.labelIds);
  });
  tx();

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const expenseId = parsePositiveIntParam(id);
  if (!expenseId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  raw.prepare('DELETE FROM expenses WHERE id = ?').run(expenseId);
  return NextResponse.json({ ok: true });
}
