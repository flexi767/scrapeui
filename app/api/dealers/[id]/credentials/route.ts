import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { parsePositiveIntParam, runMappedUpdate } from '@/lib/api/db-helpers';
import { ALLOWED_TEMPLATES } from '@/lib/dealer-config';

// GET own dealer credentials (dealer user or admin)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const { session } = check;

  const { id } = await params;
  const dealerId = parsePositiveIntParam(id);
  if (!dealerId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const isAdmin = session.user.role === 'admin';
  const isOwn = session.user.dealerId === dealerId;
  if (!isAdmin && !isOwn) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = raw.prepare(`
    SELECT id, slug, name, mobile_url, mobile_user, mobile_password,
           cars_url, cars_user, cars_password,
           facebook_user, facebook_password,
           instagram_user, instagram_password,
           tiktok_user, tiktok_password,
           public_enabled, template, public_domain
    FROM dealers WHERE id = ?
  `).get(dealerId) as Record<string, unknown> | undefined;

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

// PATCH own dealer credentials (dealer user or admin)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  const { session } = check;

  const { id } = await params;
  const dealerId = parsePositiveIntParam(id);
  if (!dealerId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const isAdmin = session.user.role === 'admin';
  const isOwn = session.user.dealerId === dealerId;
  if (!isAdmin && !isOwn) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;

  const credentialFields: Record<string, string> = {
    mobile_user: 'mobile_user', mobile_password: 'mobile_password',
    cars_url: 'cars_url', cars_user: 'cars_user', cars_password: 'cars_password',
    facebook_user: 'facebook_user', facebook_password: 'facebook_password',
    instagram_user: 'instagram_user', instagram_password: 'instagram_password',
    tiktok_user: 'tiktok_user', tiktok_password: 'tiktok_password',
  };
  const adminOnlyFields: Record<string, string> = {
    public_enabled: 'public_enabled', template: 'template',
    public_domain: 'public_domain', mobile_url: 'mobile_url',
  };

  const map = isAdmin ? { ...credentialFields, ...adminOnlyFields } : credentialFields;

  if ('template' in body && !ALLOWED_TEMPLATES.has(body.template as string)) {
    return NextResponse.json({ error: `template must be one of: ${[...ALLOWED_TEMPLATES].join(', ')}` }, { status: 400 });
  }

  const processed: Record<string, unknown> = { ...body };
  if ('public_enabled' in processed) processed.public_enabled = processed.public_enabled ? 1 : 0;

  const updated = runMappedUpdate(raw, 'dealers', 'id', dealerId, processed, map);
  if (!updated) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
