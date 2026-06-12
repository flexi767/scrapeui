import { createChildJobRoute } from '@/lib/api/child-stream';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { getDealerBySlug } from '@/lib/queries';
import { z } from 'zod';

const editFormsBodySchema = z.object({
  dealerSlug: z.string().min(1),
  mobileId: z.string().min(1),
});

export const runtime = 'nodejs';

const route = createChildJobRoute({
  alreadyRunning: 'An edit-form capture is already in progress',
  disconnectedMessage: 'Client disconnected. Stopping capture…',
  async prepare(req) {
    const parsed = editFormsBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { dealerSlug, mobileId } = parsed.data;

    if (!getMobileBgDealerConfig(getDealerBySlug(dealerSlug))) {
      return Response.json({ error: 'Dealer not found or missing mobile.bg credentials' }, { status: 400 });
    }

    return {
      scriptPath: 'scraper/scripts/run-mobilebg-action.ts',
      scriptArgs: ['--action', 'capture-edit-form', '--dealer', dealerSlug, '--mobile-id', mobileId],
      options: { silentNonJsonStdout: true },
    };
  },
  stopMessages: {
    notRunning: 'No edit-form capture is currently running',
    stopping: 'Stop requested. Terminating capture…',
    forcingShutdown: 'Capture did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
