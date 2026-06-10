import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { updateBackupOnMobileBg } from '@/lib/mobile-bg/update';
import { getDealerBySlug } from '@/lib/queries';
import { errorMessage } from '@/lib/utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('mobilebg');

const updatesBodySchema = z.object({
  dealerSlug: z.string().min(1),
  backupId: z.number().int().positive(),
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  try {
    const rawBody: unknown = await req.json();
    const parsed = updatesBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { dealerSlug, backupId } = parsed.data;

    const dealer = getDealerBySlug(dealerSlug);
    const mobileBgDealer = getMobileBgDealerConfig(dealer);
    if (!mobileBgDealer) {
      return NextResponse.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    const result = await updateBackupOnMobileBg(raw, mobileBgDealer, backupId);

    return NextResponse.json(result);
  } catch (error) {
    log.error('POST /api/mobilebg/updates error:', error);
    return NextResponse.json({ error: errorMessage(error, 'Sync failed') }, { status: 500 });
  }
}
