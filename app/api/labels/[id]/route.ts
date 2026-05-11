import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { runMappedUpdate } from '@/lib/api/db-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  const body = await request.json() as { name?: string; color?: string };

  const toUpdate: Record<string, unknown> = {};
  if (body.name) toUpdate.name = body.name.trim();
  if (body.color) toUpdate.color = body.color;

  const updated = runMappedUpdate(raw, 'labels', 'id', Number(id), toUpdate, { name: 'name', color: 'color' });
  if (!updated) return NextResponse.json({ error: 'No updates' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { id } = await params;
  raw.prepare('DELETE FROM labels WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
