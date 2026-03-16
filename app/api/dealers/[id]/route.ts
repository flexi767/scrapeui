import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  const map: Record<string, string> = {
    name: 'name',
    slug: 'slug',
    mobile_url: 'mobile_url',
    own: 'own',
    active: 'active',
    mobile_user: 'mobile_user',
    mobile_password: 'mobile_password',
    cars_user: 'cars_user',
    cars_password: 'cars_password',
  };

  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) {
      if (k === 'slug' && !/^[a-z0-9-]+$/.test(body[k])) {
        return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
      }
      fields.push(`${col} = ?`);
      values.push((k === 'own' || k === 'active') ? (body[k] ? 1 : 0) : body[k]);
    }
  }

  if (!fields.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(Number(id));
  try {
    raw.prepare(`UPDATE dealers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'update failed (maybe duplicate slug)' }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  raw.prepare('DELETE FROM dealers WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
