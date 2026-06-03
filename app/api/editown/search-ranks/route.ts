import { createChildJobRoute } from '@/lib/api/child-stream';
import { readJsonBody } from '@/lib/api/json-body';

export const runtime = 'nodejs';

const route = createChildJobRoute({
  alreadyRunning: 'A search-position run is already in progress',
  disconnectedMessage: 'Client disconnected. Stopping search-position run…',
  async prepare(req) {
    const payload = await readJsonBody<{ missingOnly?: boolean }>(req);
    const scriptArgs: string[] = [];
    if (payload?.missingOnly === true) scriptArgs.push('--missing-only');

    return {
      scriptPath: 'scraper/scripts/run-own-search-ranks.ts',
      scriptArgs,
    };
  },
  stopMessages: {
    notRunning: 'No search-position run is currently running',
    stopping: 'Stop requested. Terminating search-position run…',
    forcingShutdown: 'Search-position run did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
