import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getExpenses } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

const CreateExpenseSchema = z.object({
  title: z.string().min(1),
  amount: z.number(),
  currency: z.string().optional().default('EUR'),
  date: z.string().min(1),
  category: z.string().min(1),
  notes: z.string().optional().nullable(),
  listingIds: z.array(z.number().int()).optional().default([]),
  taskIds: z.array(z.number().int()).optional().default([]),
  labelIds: z.array(z.number().int()).optional().default([]),
});

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

  const parsed = CreateExpenseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  const now = currentIsoTimestamp();
  const listingIds = body.listingIds ?? [];
  const taskIds = body.taskIds ?? [];
  const labelIds = body.labelIds ?? [];

  let expenseId!: number;
  const tx = raw.transaction(() => {
    const result = runInsert(raw, 'expenses', {
      title: body.title.trim(),
      amount: body.amount,
      currency: body.currency,
      date: body.date,
      category: body.category,
      notes: body.notes || null,
      created_by_id: Number(session.user.id),
      created_at: now,
      updated_at: now,
    });

    expenseId = result.lastInsertRowid as number;

    insertJoinRows(raw, 'expense_listings', 'expense_id', 'listing_id', expenseId, listingIds);
    insertJoinRows(raw, 'expense_tasks', 'expense_id', 'task_id', expenseId, taskIds);
    insertJoinRows(raw, 'expense_labels', 'expense_id', 'label_id', expenseId, labelIds);
    logActivity(raw, 'expense', expenseId, 'created', null, Number(session.user.id), now);
  });
  tx();

  return NextResponse.json({ id: expenseId }, { status: 201 });
}
