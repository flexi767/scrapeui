import { createChildJobRoute } from '@/lib/api/child-stream';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { getDealerBySlug } from '@/lib/queries';
import { z } from 'zod';

const updatesBodySchema = z.object({
  dealerSlug: z.string().min(1),
  backupId: z.number().int().positive(),
});

export const runtime = 'nodejs';

const route = createChildJobRoute({
  async prepare(req) {
    const parsed = updatesBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { dealerSlug, backupId } = parsed.data;

    if (!getMobileBgDealerConfig(getDealerBySlug(dealerSlug))) {
      return Response.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    return {
      scriptPath: 'scraper/scripts/run-mobilebg-action.ts',
      scriptArgs: ['--action', 'update', '--dealer', dealerSlug, '--backup-id', String(backupId)],
      options: { silentNonJsonStdout: true },
    };
  },
  stopMessages: {
    notRunning: 'No update is currently running',
    stopping: 'Stop requested. Terminating update…',
    forcingShutdown: 'Update did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
