import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { repostBackupFromDb } from '@/lib/mobile-bg/repost';
import { getDealerBySlug } from '@/lib/queries';
import { errorMessage } from '@/lib/utils';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const log = logger.child('mobilebg');

const repostsBodySchema = z.object({
  dealerSlug: z.string().min(1),
  backupId: z.number().int().positive(),
});

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  try {
    const rawBody: unknown = await req.json();
    const parsed = repostsBodySchema.safeParse(rawBody);
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

    const result = await repostBackupFromDb(raw, mobileBgDealer, Number(backupId));

    return NextResponse.json(result);
  } catch (error) {
    log.error('POST /api/mobilebg/reposts error:', error);
    return NextResponse.json({ error: errorMessage(error, 'Publish failed') }, { status: 500 });
  }
}
