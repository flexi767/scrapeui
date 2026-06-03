import { createChildJobRoute } from '@/lib/api/child-stream';
import { readJsonBody } from '@/lib/api/json-body';

export const runtime = 'nodejs';

const route = createChildJobRoute({
  alreadyRunning: 'A renew & reset run is already in progress',
  disconnectedMessage: 'Client disconnected. Stopping…',
  async prepare(req) {
    const body = await readJsonBody<Record<string, unknown>>(req, {});
    const dealerSlugs = Array.isArray(body?.dealerSlugs)
      ? (body.dealerSlugs as unknown[]).filter((s): s is string => typeof s === 'string' && s.length > 0)
      : [];

    if (dealerSlugs.length === 0) {
      return new Response(JSON.stringify({ error: 'dealerSlugs is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scriptArgs = dealerSlugs.flatMap((slug) => ['--dealer', slug]);
    if (body?.onlyReset === true) scriptArgs.push('--only-reset');

    return {
      scriptPath: 'scraper/scripts/run-own-renew-reset.ts',
      scriptArgs,
    };
  },
  stopMessages: {
    notRunning: 'No renew & reset run is currently running',
    stopping: 'Stop requested. Terminating…',
    forcingShutdown: 'Did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
