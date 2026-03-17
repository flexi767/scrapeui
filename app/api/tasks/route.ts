import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getTasks } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    title, description, status = 'backlog', priority = 'medium',
    assigneeId, parentId, deadline, isRecurring = 0, recurRule,
    listingIds = [], labelIds = [],
  } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = raw.prepare(`
    INSERT INTO tasks (title, description, status, priority, assignee_id, created_by_id, parent_id, deadline, is_recurring, recur_rule, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(), description || null, status, priority,
    assigneeId || null, Number(session.user.id), parentId || null,
    deadline || null, isRecurring ? 1 : 0, recurRule || null, now, now,
  );

  const taskId = result.lastInsertRowid as number;

  // Link listings
  const linkListing = raw.prepare('INSERT INTO task_listings (task_id, listing_id) VALUES (?, ?)');
  for (const lid of listingIds) {
    linkListing.run(taskId, lid);
  }

  // Link labels
  const linkLabel = raw.prepare('INSERT INTO task_labels (task_id, label_id) VALUES (?, ?)');
  for (const lid of labelIds) {
    linkLabel.run(taskId, lid);
  }

  // Activity log
  raw.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
    VALUES ('task', ?, 'created', NULL, ?, ?)
  `).run(taskId, Number(session.user.id), now);

  return NextResponse.json({ id: taskId }, { status: 201 });
}
