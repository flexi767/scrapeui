import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { captureEditFormSnapshot } from '@/lib/mobile-bg/edit-form';
import { getMobileBgDealerBySlug } from '@/lib/queries';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { dealerSlug, mobileId } = await req.json() as { dealerSlug?: string; mobileId?: string };
  if (!dealerSlug || !mobileId) {
    return NextResponse.json({ error: 'dealerSlug and mobileId are required' }, { status: 400 });
  }

  const dealer = getMobileBgDealerBySlug(dealerSlug);

  if (!dealer || !dealer.mobile_user || !dealer.mobile_password) {
    return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
  }

  const result = await captureEditFormSnapshot(raw, {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name,
    mobileUrl: '',
    mobileUser: dealer.mobile_user,
    mobilePassword: dealer.mobile_password,
  }, mobileId, raw.name);

  return NextResponse.json(result);
}
