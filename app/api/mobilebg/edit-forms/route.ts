import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { captureEditFormSnapshot } from '@/lib/mobile-bg/edit-form';
import { getDealerBySlug } from '@/lib/queries';
import { z } from 'zod';

const editFormsBodySchema = z.object({
  dealerSlug: z.string().min(1),
  mobileId: z.string().min(1),
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const rawBody: unknown = await req.json();
  const parsed = editFormsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { dealerSlug, mobileId } = parsed.data;

  const dealer = getDealerBySlug(dealerSlug);
  const mobileBgDealer = getMobileBgDealerConfig(dealer);
  if (!mobileBgDealer) {
    return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
  }

  const result = await captureEditFormSnapshot(raw, mobileBgDealer, mobileId);

  return NextResponse.json(result);
}
