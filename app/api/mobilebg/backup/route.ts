import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { backupDealerToDb } from '@/lib/mobile-bg/backup';

export const runtime = 'nodejs';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  mobile_user: string | null;
  mobile_password: string | null;
}

export async function POST(req: NextRequest) {
  const { dealerSlug } = await req.json() as { dealerSlug?: string };
  if (!dealerSlug) return NextResponse.json({ error: 'dealerSlug required' }, { status: 400 });

  const dealer = raw.prepare(`
    SELECT id, slug, name, mobile_url, mobile_user, mobile_password
    FROM dealers
    WHERE slug = ?
  `).get(dealerSlug) as DealerRow | undefined;

  if (!dealer || !dealer.mobile_url || !dealer.mobile_user || !dealer.mobile_password) {
    return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
  }

  const result = await backupDealerToDb(raw, {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name,
    mobileUrl: dealer.mobile_url,
    mobileUser: dealer.mobile_user,
    mobilePassword: dealer.mobile_password,
  }, raw.name);

  return NextResponse.json(result);
}
