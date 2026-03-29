import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { updateBackupOnMobileBg } from '@/lib/mobile-bg/update';

export const runtime = 'nodejs';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_user: string | null;
  mobile_password: string | null;
}

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
    `).get(dealerSlug) as DealerRow | undefined;

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
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
