import { NextRequest } from 'next/server';
import path from 'path';
import { ChildStreamState, createSseStreamResponse, createStopResponse } from '@/lib/api/child-stream';

export const runtime = 'nodejs';

const state = new ChildStreamState();

export async function POST(req: NextRequest) {
  state.clearStale();

  if (state.child) {
    return new Response(JSON.stringify({ error: 'A batch sync run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return createSseStreamResponse(
    req,
    state,
    path.join(process.cwd(), 'scraper/scripts/run-own-batch-sync.ts'),
    [],
    'Client disconnected. Stopping batch sync…',
  );
}

export async function DELETE() {
  return createStopResponse(state, {
    notRunning: 'No batch sync run is currently running',
    stopping: 'Stop requested. Terminating batch sync…',
    forcingShutdown: 'Batch sync did not stop in time. Forcing shutdown…',
  });
}
