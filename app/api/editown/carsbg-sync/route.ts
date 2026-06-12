import { createChildJobRoute } from '@/lib/api/child-stream';
import { readJsonBody } from '@/lib/api/json-body';

export const runtime = 'nodejs';

const route = createChildJobRoute({
  async prepare(req) {
    const payload = await readJsonBody<{ live?: boolean; dealers?: string[] }>(req);
    const scriptArgs: string[] = [];
    if (payload?.live) scriptArgs.push('--live');
    if (payload?.dealers?.length) {
      scriptArgs.push('--dealers', payload.dealers.join(','));
    }

    return {
      scriptPath: 'scraper/scripts/run-carsbg-sync.ts',
      scriptArgs,
    };
  },
  stopMessages: {
    notRunning: 'No cars.bg sync run is currently running',
    stopping: 'Stop requested. Terminating cars.bg sync…',
    forcingShutdown: 'Cars.bg sync did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
