import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { name, color } = await request.json();

  const updates: string[] = [];
  const values: (string | number)[] = [];
  if (name) { updates.push('name = ?'); values.push(name.trim()); }
  if (color) { updates.push('color = ?'); values.push(color); }

  if (updates.length === 0) return NextResponse.json({ error: 'No updates' }, { status: 400 });

  raw.prepare(`UPDATE labels SET ${updates.join(', ')} WHERE id = ?`).run(...values, Number(id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  raw.prepare('DELETE FROM labels WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
