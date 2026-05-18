import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { parsePositiveIntParam, runMappedUpdate } from '@/lib/api/db-helpers';
import { ALLOWED_TEMPLATES, isValidDealerSlug } from '@/lib/dealer-config';
import { DEALER_ADMIN_FIELD_MAP } from '@/lib/dealers/fieldMaps';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const dealerId = parsePositiveIntParam(id);
  if (!dealerId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  const body = await req.json() as Record<string, unknown>;

  if (body.slug && !isValidDealerSlug(body.slug as string)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  if (body.template && !ALLOWED_TEMPLATES.has(body.template as string)) {
    return NextResponse.json({ error: `template must be one of: ${[...ALLOWED_TEMPLATES].join(', ')}` }, { status: 400 });
  }

  const processed: Record<string, unknown> = { ...body };
  for (const k of ['own', 'active', 'public_enabled']) if (k in processed) processed[k] = processed[k] ? 1 : 0;
  if ('priority' in processed) processed.priority = Number(processed.priority);

  try {
    const updated = runMappedUpdate(raw, 'dealers', 'id', dealerId, processed, DEALER_ADMIN_FIELD_MAP);
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
  const dealerId = parsePositiveIntParam(id);
  if (!dealerId) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  raw.prepare('DELETE FROM dealers WHERE id = ?').run(dealerId);
  return NextResponse.json({ ok: true });
}
