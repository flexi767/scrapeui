import { NextRequest } from 'next/server';
import path from 'path';
import { ChildStreamState, createSseStreamResponse, createStopResponse } from '@/lib/api/child-stream';
import { readJsonBody } from '@/lib/api/json-body';

export const runtime = 'nodejs';

const state = new ChildStreamState();

export async function POST(req: NextRequest) {
  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A renew & reset run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let dealerSlugs: string[] = [];
  let onlyReset = false;
  const body = await readJsonBody<Record<string, unknown>>(req, {});
  if (Array.isArray(body?.dealerSlugs)) {
    dealerSlugs = (body.dealerSlugs as unknown[]).filter((s): s is string => typeof s === 'string' && s.length > 0);
  }
  if (body?.onlyReset === true) {
    onlyReset = true;
  }

  if (dealerSlugs.length === 0) {
    return new Response(JSON.stringify({ error: 'dealerSlugs is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs: string[] = [];
  for (const slug of dealerSlugs) {
    scriptArgs.push('--dealer', slug);
  }
  if (onlyReset) scriptArgs.push('--only-reset');

  return createSseStreamResponse(
    req,
    state,
    path.join(process.cwd(), 'scraper/scripts/run-own-renew-reset.ts'),
    scriptArgs,
    'Client disconnected. Stopping…',
  );
}

export async function DELETE() {
  return createStopResponse(state, {
    notRunning: 'No renew & reset run is currently running',
    stopping: 'Stop requested. Terminating…',
    forcingShutdown: 'Did not stop in time. Forcing shutdown…',
  });
}
