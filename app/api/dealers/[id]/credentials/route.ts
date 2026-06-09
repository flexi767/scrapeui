import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { canAccessDealer, requireAuth } from '@/lib/api/auth-helpers';
import { parsePositiveIntParam, runMappedUpdate } from '@/lib/api/db-helpers';
import { ALLOWED_TEMPLATES } from '@/lib/dealer-config';
import {
  DEALER_ADMIN_CREDENTIAL_FIELD_MAP,
  DEALER_SELF_SERVICE_CREDENTIAL_FIELD_MAP,
} from '@/lib/dealers/fieldMaps';
import { PLATFORM_ACCOUNT_COLUMNS } from '@/lib/dealers/platformCredentials';
import { SOCIAL_ACCOUNT_COLUMNS } from '@/lib/dealers/socialCredentials';

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

  if (!canAccessDealer(session, dealerId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const row = raw.prepare(`
    SELECT id, slug, name,
           ${PLATFORM_ACCOUNT_COLUMNS},
           ${SOCIAL_ACCOUNT_COLUMNS},
           public_enabled, template, public_domain, public_content
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
  if (!canAccessDealer(session, dealerId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;

  const map = isAdmin ? DEALER_ADMIN_CREDENTIAL_FIELD_MAP : DEALER_SELF_SERVICE_CREDENTIAL_FIELD_MAP;

  if ('template' in body && !ALLOWED_TEMPLATES.has(body.template as string)) {
    return NextResponse.json({ error: `template must be one of: ${[...ALLOWED_TEMPLATES].join(', ')}` }, { status: 400 });
  }

  const processed: Record<string, unknown> = { ...body };
  if ('public_enabled' in processed) processed.public_enabled = processed.public_enabled ? 1 : 0;

  const updated = runMappedUpdate(raw, 'dealers', 'id', dealerId, processed, map);
  if (!updated) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
