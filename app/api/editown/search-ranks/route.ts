import { NextRequest } from 'next/server';
import path from 'path';
import { ChildStreamState, createSseStreamResponse, createStopResponse } from '@/lib/api/child-stream';
import { readJsonBody } from '@/lib/api/json-body';

export const runtime = 'nodejs';

const state = new ChildStreamState();

export async function POST(req: NextRequest) {
  const payload = await readJsonBody<{ missingOnly?: boolean }>(req);

  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A search-position run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs: string[] = [];
  if (payload?.missingOnly === true) scriptArgs.push('--missing-only');

  return createSseStreamResponse(
    req,
    state,
    path.join(process.cwd(), 'scraper/scripts/run-own-search-ranks.ts'),
    scriptArgs,
    'Client disconnected. Stopping search-position run…',
  );
}

export async function DELETE() {
  return createStopResponse(state, {
    notRunning: 'No search-position run is currently running',
    stopping: 'Stop requested. Terminating search-position run…',
    forcingShutdown: 'Search-position run did not stop in time. Forcing shutdown…',
  });
}
