import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { captureEditFormSnapshot } from '@/lib/mobile-bg/edit-form';
import { getDealerBySlug } from '@/lib/queries';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { dealerSlug, mobileId } = await req.json() as { dealerSlug?: string; mobileId?: string };
  if (!dealerSlug || !mobileId) {
    return NextResponse.json({ error: 'dealerSlug and mobileId are required' }, { status: 400 });
  }

  const dealer = getDealerBySlug(dealerSlug);
  const mobileBgDealer = getMobileBgDealerConfig(dealer);
  if (!mobileBgDealer) {
    return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
  }

  const result = await captureEditFormSnapshot(raw, mobileBgDealer, mobileId);

  return NextResponse.json(result);
}
