import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { runMappedUpdate } from '@/lib/api/db-helpers';

const DEALER_FIELD_MAP: Record<string, string> = {
  name: 'name', slug: 'slug', mobile_url: 'mobile_url',
  own: 'own', active: 'active', priority: 'priority',
  mobile_user: 'mobile_user', mobile_password: 'mobile_password',
  cars_url: 'cars_url', cars_user: 'cars_user', cars_password: 'cars_password',
  public_enabled: 'public_enabled', template: 'template', public_domain: 'public_domain',
  facebook_user: 'facebook_user', facebook_password: 'facebook_password',
  instagram_user: 'instagram_user', instagram_password: 'instagram_password',
  tiktok_user: 'tiktok_user', tiktok_password: 'tiktok_password',
};

const ALLOWED_TEMPLATES = new Set(['bold', 'executive', 'atlas', 'night', 'sunset', 'pro']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const body = await req.json() as Record<string, unknown>;

  if (body.slug && !/^[a-z0-9-]+$/.test(body.slug as string)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  if (body.template && !ALLOWED_TEMPLATES.has(body.template as string)) {
    return NextResponse.json({ error: `template must be one of: ${[...ALLOWED_TEMPLATES].join(', ')}` }, { status: 400 });
  }

  const processed: Record<string, unknown> = { ...body };
  for (const k of ['own', 'active', 'public_enabled']) if (k in processed) processed[k] = processed[k] ? 1 : 0;
  if ('priority' in processed) processed.priority = Number(processed.priority);

  try {
    const updated = runMappedUpdate(raw, 'dealers', 'id', Number(id), processed, DEALER_FIELD_MAP);
    if (!updated) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'update failed (maybe duplicate slug)' }, { status: 409 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  raw.prepare('DELETE FROM dealers WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
