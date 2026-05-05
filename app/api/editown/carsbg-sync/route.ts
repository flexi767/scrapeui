import { NextRequest } from 'next/server';
import path from 'path';
import { ChildStreamState, createSseStreamResponse, createStopResponse } from '@/lib/api/child-stream';

export const runtime = 'nodejs';

const state = new ChildStreamState();

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null) as { live?: boolean; dealers?: string[] } | null;

  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A cars.bg sync run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs: string[] = [];
  if (payload?.live) scriptArgs.push('--live');
  if (payload?.dealers?.length) {
    scriptArgs.push('--dealers', payload.dealers.join(','));
  }

  return createSseStreamResponse(
    req,
    state,
    path.join(process.cwd(), 'scraper/scripts/run-carsbg-sync.ts'),
    scriptArgs,
    'Client disconnected. Stopping cars.bg sync…',
  );
}

export async function DELETE() {
  return createStopResponse(state, {
    notRunning: 'No cars.bg sync run is currently running',
    stopping: 'Stop requested. Terminating cars.bg sync…',
    forcingShutdown: 'Cars.bg sync did not stop in time. Forcing shutdown…',
  });
}
