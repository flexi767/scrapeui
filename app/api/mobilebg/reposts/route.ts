import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { repostBackupFromDb } from '@/lib/mobile-bg/repost';
import { getDealerBySlug } from '@/lib/queries';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { dealerSlug, backupId } = await req.json() as { dealerSlug?: string; backupId?: number };
    if (!dealerSlug || !backupId) {
      return NextResponse.json({ error: 'dealerSlug and backupId are required' }, { status: 400 });
    }

    const dealer = getDealerBySlug(dealerSlug);
    const mobileBgDealer = getMobileBgDealerConfig(dealer);
    if (!mobileBgDealer) {
      return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    const result = await repostBackupFromDb(raw, mobileBgDealer, Number(backupId));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'Publish failed') }, { status: 500 });
  }
}
