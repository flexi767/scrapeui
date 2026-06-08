import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { updateBackupOnMobileBg } from '@/lib/mobile-bg/update';
import { getDealerBySlug } from '@/lib/queries';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

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

    const result = await updateBackupOnMobileBg(raw, mobileBgDealer, backupId);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'Sync failed') }, { status: 500 });
  }
}
