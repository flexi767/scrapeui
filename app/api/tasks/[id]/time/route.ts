import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getTaskTimeEntries } from '@/lib/queries';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const entries = getTaskTimeEntries(Number(id));
  return NextResponse.json(entries);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { description, durationMinutes, date } = await request.json();

  if (!durationMinutes || !date) {
    return NextResponse.json({ error: 'Duration and date are required' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = raw.prepare(`
    INSERT INTO time_entries (task_id, user_id, description, duration_minutes, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(Number(id), Number(session.user.id), description || null, durationMinutes, date, now);

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 });
}
