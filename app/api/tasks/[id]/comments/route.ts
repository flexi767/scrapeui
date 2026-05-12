import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getTaskComments } from '@/lib/queries';
import { logActivity, parsePositiveIntParam } from '@/lib/api/db-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const comments = getTaskComments(taskId);
  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const session = check.session;

  const { id } = await params;
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const { body } = await request.json();
  const now = new Date().toISOString();

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const result = raw.prepare(`
    INSERT INTO comments (task_id, author_id, body, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(taskId, Number(session.user.id), body, now, now);

  logActivity(raw, 'task', taskId, 'comment_added', null, Number(session.user.id), now);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
