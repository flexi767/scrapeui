import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin();
  if (authError) return authError;

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
    priority: 'priority',
    mobile_user: 'mobile_user',
    mobile_password: 'mobile_password',
    cars_url: 'cars_url',
    cars_user: 'cars_user',
    cars_password: 'cars_password',
    public_enabled: 'public_enabled',
    template: 'template',
    public_domain: 'public_domain',
  };

  const boolFields = new Set(['own', 'active', 'public_enabled']);
  const numFields = new Set(['priority']);
  const allowedTemplates = new Set(['bold', 'executive', 'atlas', 'night', 'sunset', 'pro']);

  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) {
      if (k === 'slug' && !/^[a-z0-9-]+$/.test(body[k])) {
        return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
      }
      if (k === 'template' && !allowedTemplates.has(body[k])) {
        return NextResponse.json({ error: `template must be one of: ${[...allowedTemplates].join(', ')}` }, { status: 400 });
      }
      fields.push(`${col} = ?`);
      if (boolFields.has(k)) values.push(body[k] ? 1 : 0);
      else if (numFields.has(k)) values.push(Number(body[k]));
      else values.push(body[k] ?? null);
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
  const authError = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  raw.prepare('DELETE FROM dealers WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
