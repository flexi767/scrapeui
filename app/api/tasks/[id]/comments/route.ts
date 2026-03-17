import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getTaskComments } from '@/lib/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const comments = getTaskComments(Number(id));
  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { body } = await request.json();
  const now = new Date().toISOString();

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Body is required' }, { status: 400 });
  }

  const result = raw.prepare(`
    INSERT INTO comments (task_id, author_id, body, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(id), Number(session.user.id), body, now, now);

  raw.prepare(`
    INSERT INTO activity_log (entity_type, entity_id, action, detail, user_id, created_at)
    VALUES ('task', ?, 'comment_added', NULL, ?, ?)
  `).run(Number(id), Number(session.user.id), now);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
