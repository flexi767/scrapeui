import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { currentIsoTimestamp, formatDateInputValue } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';
import { getTaskById } from '@/lib/queries';
import { copyJoinRows, logActivity, parsePositiveIntParam, replaceJoinRows, runMappedUpdate } from '@/lib/api/db-helpers';

interface CurrentTaskRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  created_by_id: number | null;
  deadline: string | null;
  is_recurring: number;
  recur_rule: string | null;
}

const PatchTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.number().int().optional().nullable(),
  parentId: z.number().int().optional().nullable(),
  deadline: z.string().optional().nullable(),
  isRecurring: z.union([z.literal(0), z.literal(1), z.boolean()]).optional(),
  recurRule: z.string().optional().nullable(),
  listingIds: z.array(z.number().int()).optional(),
  labelIds: z.array(z.number().int()).optional(),
}).passthrough();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const task = getTaskById(taskId);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const parsed = PatchTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const now = currentIsoTimestamp();

  // Get current task for activity log
  const current = raw.prepare(`
    SELECT id, title, description, status, priority, assignee_id, created_by_id,
      deadline, is_recurring, recur_rule
    FROM tasks
    WHERE id = ?
  `).get(taskId) as CurrentTaskRow | undefined;
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const bodyMap: Record<string, string> = {
    title: 'title', description: 'description', status: 'status',
    priority: 'priority', assigneeId: 'assignee_id', parentId: 'parent_id',
    deadline: 'deadline', isRecurring: 'is_recurring', recurRule: 'recur_rule',
  };

  const hasFieldUpdate = Object.keys(bodyMap).some((key) => key in body);
  if (!hasFieldUpdate && !body.listingIds && !body.labelIds) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 });
  }

  const tx = raw.transaction(() => {
    runMappedUpdate(raw, 'tasks', 'id', taskId, body, bodyMap, { updated_at: now });

    replaceJoinRows(raw, 'task_listings', 'task_id', 'listing_id', taskId, body.listingIds);
    replaceJoinRows(raw, 'task_labels', 'task_id', 'label_id', taskId, body.labelIds);

    // Log status changes
    if (body.status && body.status !== current.status) {
      logActivity(raw, 'task', taskId, 'status_changed', JSON.stringify({ from: current.status, to: body.status }), Number(session.user.id), now);

      // Handle recurring task completion
      if (body.status === 'done' && current.is_recurring === 1 && current.recur_rule) {
        createNextRecurring(taskId, current);
      }
    }

    // Log assignment changes
    if ('assigneeId' in body && body.assigneeId !== current.assignee_id) {
      logActivity(raw, 'task', taskId, 'assigned', JSON.stringify({ from: current.assignee_id, to: body.assigneeId }), Number(session.user.id), now);
    }
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
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  raw.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  return NextResponse.json({ ok: true });
}

function createNextRecurring(parentTaskId: number, parentTask: CurrentTaskRow) {
  const now = currentIsoTimestamp();
  let nextDeadline: string | null = null;

  if (parentTask.deadline && parentTask.recur_rule) {
    try {
      const rule = JSON.parse(parentTask.recur_rule) as { interval?: string; every?: number };
      const current = new Date(parentTask.deadline);
      const every = rule.every || 1;

      if (rule.interval === 'daily') current.setDate(current.getDate() + every);
      else if (rule.interval === 'weekly') current.setDate(current.getDate() + 7 * every);
      else if (rule.interval === 'monthly') current.setMonth(current.getMonth() + every);

      nextDeadline = formatDateInputValue(current);
    } catch { /* ignore parse errors */ }
  }

  const result = runInsert(raw, 'tasks', {
    title: parentTask.title,
    description: parentTask.description,
    status: 'backlog',
    priority: parentTask.priority,
    assignee_id: parentTask.assignee_id,
    created_by_id: parentTask.created_by_id,
    parent_id: parentTaskId,
    deadline: nextDeadline,
    is_recurring: 1,
    recur_rule: parentTask.recur_rule,
    created_at: now,
    updated_at: now,
  });

  const newTaskId = result.lastInsertRowid as number;

  copyJoinRows(raw, 'task_labels', 'task_id', 'label_id', parentTaskId, newTaskId);
  copyJoinRows(raw, 'task_listings', 'task_id', 'listing_id', parentTaskId, newTaskId);
}
