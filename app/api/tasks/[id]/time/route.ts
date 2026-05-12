import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getTaskTimeEntries } from '@/lib/queries';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const taskId = parsePositiveIntParam(id);
  if (!taskId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const entries = getTaskTimeEntries(taskId);
  return NextResponse.json(entries);
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
  const { description, durationMinutes, date } = await request.json();

  if (!durationMinutes || !date) {
    return NextResponse.json({ error: 'Duration and date are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = raw.prepare(`
    INSERT INTO time_entries (task_id, user_id, description, duration_minutes, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, Number(session.user.id), description || null, durationMinutes, date, now);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
