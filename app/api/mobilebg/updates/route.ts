import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { updateBackupOnMobileBg } from '@/lib/mobile-bg/update';
import { getMobileBgDealerBySlug } from '@/lib/queries';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { dealerSlug, backupId } = await req.json() as { dealerSlug?: string; backupId?: number };
    if (!dealerSlug || !backupId) {
      return NextResponse.json({ error: 'dealerSlug and backupId are required' }, { status: 400 });
    }

    const dealer = getMobileBgDealerBySlug(dealerSlug);

    if (!dealer || !dealer.mobile_user || !dealer.mobile_password) {
      return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    const result = await updateBackupOnMobileBg(raw, {
      id: dealer.id,
      slug: dealer.slug,
      name: dealer.name,
      mobileUrl: '',
      mobileUser: dealer.mobile_user,
      mobilePassword: dealer.mobile_password,
    }, backupId, raw.name);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
