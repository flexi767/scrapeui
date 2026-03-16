import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.slug !== undefined) {
    if (!/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
    }
    fields.push('slug = ?'); values.push(body.slug);
  }
  if (body.mobile_url !== undefined) { fields.push('mobile_url = ?'); values.push(body.mobile_url); }
  if (body.active !== undefined) { fields.push('active = ?'); values.push(body.active ? 1 : 0); }

  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(Number(id));
  try {
    raw.prepare(`UPDATE competitors SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'update failed (maybe duplicate slug)' }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  raw.prepare('DELETE FROM competitors WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
