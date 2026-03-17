import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getTaskById } from '@/lib/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const task = getTaskById(Number(id));
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(task);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const taskId = Number(id);
  const body = await request.json();
  const now = new Date().toISOString();

  // Get current task for activity log
  const current = raw.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined;
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  const fields = ['title', 'description', 'status', 'priority', 'assignee_id', 'parent_id', 'deadline', 'is_recurring', 'recur_rule'] as const;
  const bodyMap: Record<string, string> = {
    title: 'title', description: 'description', status: 'status',
    priority: 'priority', assigneeId: 'assignee_id', parentId: 'parent_id',
    deadline: 'deadline', isRecurring: 'is_recurring', recurRule: 'recur_rule',
  };

  for (const [bodyKey, dbCol] of Object.entries(bodyMap)) {
    if (bodyKey in body) {
      updates.push(`${dbCol} = ?`);
      values.push(body[bodyKey] ?? null);
    }
  }

  if (updates.length === 0 && !body.listingIds && !body.labelIds) {
    return NextResponse.json({ error: 'No updates' }, { status: 400 });
  }

  if (updates.length > 0) {
    updates.push('updated_at = ?');
    values.push(now);
    raw.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values, taskId);
  }

  // Update listings if provided
  if (body.listingIds) {
    raw.prepare('DELETE FROM task_listings WHERE task_id = ?').run(taskId);
    const linkListing = raw.prepare('INSERT INTO task_listings (task_id, listing_id) VALUES (?, ?)');
    for (const lid of body.listingIds) {
      linkListing.run(taskId, lid);
    }
  }

  // Update labels if provided
  if (body.labelIds) {
    raw.prepare('DELETE FROM task_labels WHERE task_id = ?').run(taskId);
    const linkLabel = raw.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
    for (const lid of body.labelIds) {
      linkLabel.run(taskId, lid);
    }
  }

  // Log status changes
  if (body.status && body.status !== current.status) {
    raw.prepare(`
      INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
      VALUES ('task', ?, 'status_changed', ?, ?, ?)
    `).run(taskId, JSON.stringify({ from: current.status, to: body.status }), Number(session.user.id), now);

    // Handle recurring task completion
    if (body.status === 'done' && current.is_recurring === 1 && current.recur_rule) {
      createNextRecurring(taskId, current);
    }
  }

  // Log assignment changes
  if ('assigneeId' in body && body.assigneeId !== current.assignee_id) {
    raw.prepare(`
      INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
      VALUES ('task', ?, 'assigned', ?, ?, ?)
    `).run(taskId, JSON.stringify({ from: current.assignee_id, to: body.assigneeId }), Number(session.user.id), now);
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
  raw.prepare('DELETE FROM tasks WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}

function createNextRecurring(parentTaskId: number, parentTask: Record<string, unknown>) {
  const now = new Date().toISOString();
  let nextDeadline: string | null = null;

  if (parentTask.deadline && parentTask.recur_rule) {
    try {
      const rule = JSON.parse(parentTask.recur_rule as string);
      const current = new Date(parentTask.deadline as string);
      const every = rule.every || 1;

      if (rule.interval === 'daily') current.setDate(current.getDate() + every);
      else if (rule.interval === 'weekly') current.setDate(current.getDate() + 7 * every);
      else if (rule.interval === 'monthly') current.setMonth(current.getMonth() + every);

      nextDeadline = current.toISOString().split('T')[0];
    } catch { /* ignore parse errors */ }
  }

  const result = raw.prepare(`
    INSERT INTO tasks (title, description, status, priority, assignee_id, created_by_id, parent_id, deadline, is_recurring, recur_rule, created_at, updated_at)
    VALUES (?, ?, 'backlog', ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).run(
    parentTask.title, parentTask.description, parentTask.priority,
    parentTask.assignee_id, parentTask.created_by_id, parentTaskId,
    nextDeadline, parentTask.recur_rule, now, now,
  );

  const newTaskId = result.lastInsertRowid as number;

  // Copy labels
  const labels = raw.prepare('SELECT label_id FROM task_labels WHERE task_id = ?').all(parentTaskId) as { label_id: number }[];
  const linkLabel = raw.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
  for (const l of labels) linkLabel.run(newTaskId, l.label_id);

  // Copy listings
  const listings = raw.prepare('SELECT listing_id FROM task_listings WHERE task_id = ?').all(parentTaskId) as { listing_id: number }[];
  const linkListing = raw.prepare('INSERT INTO task_listings (task_id, listing_id) VALUES (?, ?)');
  for (const l of listings) linkListing.run(newTaskId, l.listing_id);
}
