import { NextRequest } from 'next/server';
import path from 'path';
import { ChildStreamState, createSseStreamResponse, createStopResponse } from '@/lib/api/child-stream';
import { CRAWLEE_STORAGE_DIR } from '@/lib/storage-paths';

export const runtime = 'nodejs';

const state = new ChildStreamState();

export async function POST(req: NextRequest) {
  const { dealers, deepCrawl, source } = await req.json();

  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A scraper run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs = ['--dealers', (dealers as string[]).join(',')];
  if (deepCrawl) scriptArgs.push('--deep');

  const scriptName = source === 'carsbg'
    ? 'scraper/scripts/run-carsbg-for-ui.ts'
    : 'scraper/scripts/run-for-ui.ts';

  return createSseStreamResponse(
    req,
    state,
    path.join(process.cwd(), scriptName),
    scriptArgs,
    'Client disconnected. Stopping scraper…',
    {
      closeEventType: 'complete',
      silentNonJsonStdout: true,
      env: {
        ...process.env,
        CRAWLEE_STORAGE_DIR: process.env.CRAWLEE_STORAGE_DIR ?? CRAWLEE_STORAGE_DIR,
      },
    },
  );
}

export async function DELETE() {
  return createStopResponse(state, {
    notRunning: 'No scraper is currently running',
    stopping: 'Stop requested. Terminating scraper…',
    forcingShutdown: 'Scraper did not stop in time. Forcing shutdown…',
  });
}
