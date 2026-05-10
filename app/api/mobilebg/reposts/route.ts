import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { repostBackupFromDb } from '@/lib/mobile-bg/repost';
import type { MobileBgDealerRow } from '@/lib/mobile-bg/constants';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { dealerSlug, backupId } = await req.json() as { dealerSlug?: string; backupId?: number };
    if (!dealerSlug || !backupId) {
      return NextResponse.json({ error: 'dealerSlug and backupId are required' }, { status: 400 });
    }

    const dealer = raw.prepare(`
      SELECT id, slug, name, mobile_user, mobile_password
      FROM dealers
      WHERE slug = ?
    `).get(dealerSlug) as MobileBgDealerRow | undefined;

    if (!dealer || !dealer.mobile_user || !dealer.mobile_password) {
      return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    const result = await repostBackupFromDb(raw, {
      id: dealer.id,
      slug: dealer.slug,
      name: dealer.name,
      mobileUrl: '',
      mobileUser: dealer.mobile_user,
      mobilePassword: dealer.mobile_password,
    }, Number(backupId), raw.name);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
