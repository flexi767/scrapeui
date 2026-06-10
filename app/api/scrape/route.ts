import { createChildJobRoute } from '@/lib/api/child-stream';
import { CRAWLEE_STORAGE_DIR } from '@/lib/storage-paths';
import { requireAdmin } from '@/lib/api/auth-helpers';

export const runtime = 'nodejs';

const route = createChildJobRoute({
  alreadyRunning: 'A scraper run is already in progress',
  disconnectedMessage: 'Client disconnected. Stopping scraper…',
  async prepare(req) {
    const { dealers, deepCrawl, downloadImages, source } = await req.json();
    const scriptArgs = ['--dealers', (dealers as string[]).join(',')];
    if (deepCrawl) scriptArgs.push('--deep');
    if (downloadImages && deepCrawl) scriptArgs.push('--download-images');

    return {
      scriptPath: source === 'carsbg'
        ? 'scraper/scripts/run-carsbg-for-ui.ts'
        : 'scraper/scripts/run-for-ui.ts',
      scriptArgs,
      options: {
        closeEventType: 'complete',
        silentNonJsonStdout: true,
        env: {
          ...process.env,
          CRAWLEE_STORAGE_DIR: process.env.CRAWLEE_STORAGE_DIR ?? CRAWLEE_STORAGE_DIR,
        },
      },
    };
  },
  stopMessages: {
    notRunning: 'No scraper is currently running',
    stopping: 'Stop requested. Terminating scraper…',
    forcingShutdown: 'Scraper did not stop in time. Forcing shutdown…',
  },
});

export async function POST(req: Request) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;
  return route.POST(req);
}

export async function DELETE() {
  const check = await requireAdmin();
  if ('error' in check) return check.error;
  return route.DELETE();
}
