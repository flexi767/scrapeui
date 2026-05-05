import { raw } from '@/db/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  priority: number;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_url: string | null;
  cars_user: string | null;
  cars_password: string | null;
  public_enabled: number;
  template: string;
  public_domain: string | null;
  active_template_config_id: number | null;
  created_at: string | null;
}

export async function GET() {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const rows = raw.prepare('SELECT id, slug, name, mobile_url, own, active, priority, cars_url, mobile_user, mobile_password, cars_user, cars_password, public_enabled, template, public_domain, active_template_config_id, created_at FROM dealers ORDER BY priority DESC, name').all() as DealerRow[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { name, slug, mobile_url, own = false, priority = 0, mobile_user = null, mobile_password = null, cars_url = null, cars_user = null, cars_password = null } = await req.json();
  if (!name || !slug || !mobile_url) {
    return NextResponse.json({ error: 'name, slug, mobile_url required' }, { status: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'slug must be lowercase alphanumeric with dashes' }, { status: 400 });
  }
  try {
    const result = raw.prepare(
      'INSERT INTO dealers (slug, name, mobile_url, own, active, priority, cars_url, mobile_user, mobile_password, cars_user, cars_password, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)'
    ).run(slug, name, mobile_url, own ? 1 : 0, priority, cars_url, mobile_user, mobile_password, cars_user, cars_password, new Date().toISOString());
    return NextResponse.json({ id: result.lastInsertRowid, slug, name, mobile_url, own: own ? 1 : 0, active: 1, priority, cars_url, mobile_user, mobile_password, cars_user, cars_password, public_enabled: 0, template: 'bold', public_domain: null });
  } catch {
    return NextResponse.json({ error: 'slug already exists' }, { status: 409 });
  }
}
