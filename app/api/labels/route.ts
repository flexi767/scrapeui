import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';
import { getAllLabels } from '@/lib/queries';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(getAllLabels());
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, color = '#6b7280' } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = raw.prepare('INSERT INTO labels (name, color) VALUES (?, ?)').run(name.trim(), color);
  return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), color }, { status: 201 });
}
