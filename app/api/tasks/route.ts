import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getTasks } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.string().optional().default('backlog'),
  priority: z.string().optional().default('medium'),
  assigneeId: z.number().int().optional().nullable(),
  parentId: z.number().int().optional().nullable(),
  deadline: z.string().optional().nullable(),
  isRecurring: z.union([z.literal(0), z.literal(1), z.boolean()]).optional().default(0),
  recurRule: z.string().optional().nullable(),
  listingIds: z.array(z.number().int()).optional().default([]),
  labelIds: z.array(z.number().int()).optional().default([]),
});

export async function GET(request: NextRequest) {
  const check = await requireApiPagePermission('tasks');
  if ('error' in check) return check.error;

  const sp = request.nextUrl.searchParams;
  const result = getTasks({
    status: sp.get('status') || undefined,
    priority: sp.get('priority') || undefined,
    assigneeId: sp.get('assigneeId') ? Number(sp.get('assigneeId')) : undefined,
    search: sp.get('search') || undefined,
    page: sp.get('page') ? Number(sp.get('page')) : 1,
    limit: sp.get('limit') ? Number(sp.get('limit')) : 50,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const check = await requireApiPagePermission('tasks');
  if ('error' in check) return check.error;
  const session = check.session;

  const parsed = CreateTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const listingIds = body.listingIds ?? [];
  const labelIds = body.labelIds ?? [];

  let taskId!: number;
  const tx = raw.transaction(() => {
    const result = runInsert(raw, 'tasks', {
      title: body.title.trim(),
      description: body.description || null,
      status: body.status,
      priority: body.priority,
      assignee_id: body.assigneeId || null,
      created_by_id: Number(session.user.id),
      parent_id: body.parentId || null,
      deadline: body.deadline || null,
      is_recurring: body.isRecurring ? 1 : 0,
      recur_rule: body.recurRule || null,
      created_at: now,
      updated_at: now,
    });

    taskId = result.lastInsertRowid as number;

    insertJoinRows(raw, 'task_listings', 'task_id', 'listing_id', taskId, listingIds);
    insertJoinRows(raw, 'task_labels', 'task_id', 'label_id', taskId, labelIds);
    logActivity(raw, 'task', taskId, 'created', null, Number(session.user.id), now);
  });
  tx();

  return NextResponse.json({ id: taskId }, { status: 201 });
}
