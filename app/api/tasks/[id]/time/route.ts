import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getTaskTimeEntries } from '@/lib/queries';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';

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

  const now = currentIsoTimestamp();
  const result = runInsert(raw, 'time_entries', {
    task_id: taskId,
    user_id: Number(session.user.id),
    description: description || null,
    duration_minutes: durationMinutes,
    date,
    created_at: now,
  });

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
