import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { getUserWithPermissions, setUserPagePermissions } from '@/lib/queries';
import { isPageKey, PAGE_KEYS } from '@/lib/page-permissions';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const user = getUserWithPermissions(userId);
  if (!user) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({ ...user, allPageKeys: PAGE_KEYS });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return NextResponse.json({ error: 'invalid user id' }, { status: 400 });
  }

  const body = await req.json() as { pageKeys?: unknown };
  const incoming = Array.isArray(body.pageKeys) ? body.pageKeys : [];
  const pageKeys = incoming.filter((key): key is string => typeof key === 'string' && isPageKey(key));

  setUserPagePermissions(userId, pageKeys);
  return NextResponse.json({ ok: true, pageKeys });
}
