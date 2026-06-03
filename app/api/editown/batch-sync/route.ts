import { createChildJobRoute } from '@/lib/api/child-stream';

export const runtime = 'nodejs';

const route = createChildJobRoute({
  alreadyRunning: 'A batch sync run is already in progress',
  disconnectedMessage: 'Client disconnected. Stopping batch sync…',
  prepare() {
    return {
      scriptPath: 'scraper/scripts/run-own-batch-sync.ts',
    };
  },
  stopMessages: {
    notRunning: 'No batch sync run is currently running',
    stopping: 'Stop requested. Terminating batch sync…',
    forcingShutdown: 'Batch sync did not stop in time. Forcing shutdown…',
  },
});

export const POST = route.POST;
export const DELETE = route.DELETE;
