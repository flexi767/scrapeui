import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getTasks } from '@/lib/queries';
import { insertJoinRows, logActivity } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

export async function GET(request: NextRequest) {
  const check = await requireAuth();
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
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const body = await request.json();
  const {
    title, description, status = 'backlog', priority = 'medium',
    assigneeId, parentId, deadline, isRecurring = 0, recurRule,
    listingIds = [], labelIds = [],
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const result = runInsert(raw, 'tasks', {
    title: title.trim(),
    description: description || null,
    status,
    priority,
    assignee_id: assigneeId || null,
    created_by_id: Number(session.user.id),
    parent_id: parentId || null,
    deadline: deadline || null,
    is_recurring: isRecurring ? 1 : 0,
    recur_rule: recurRule || null,
    created_at: now,
    updated_at: now,
  });

  const taskId = result.lastInsertRowid as number;

  insertJoinRows(raw, 'task_listings', 'task_id', 'listing_id', taskId, listingIds);
  insertJoinRows(raw, 'task_labels', 'task_id', 'label_id', taskId, labelIds);
  logActivity(raw, 'task', taskId, 'created', null, Number(session.user.id), now);

  return NextResponse.json({ id: taskId }, { status: 201 });
}
