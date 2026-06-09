import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { getUserByDealerId } from '@/lib/queries';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  const { id } = await params;
  const dealerId = parseInt(id, 10);
  if (Number.isNaN(dealerId)) {
    return NextResponse.json({ error: 'invalid dealer id' }, { status: 400 });
  }

  const user = getUserByDealerId(dealerId);
  if (!user) return NextResponse.json({ error: 'no user for this dealer' }, { status: 404 });

  return NextResponse.json(user);
}
