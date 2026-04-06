import { NextRequest } from 'next/server';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

let activeCarsBgSyncChild: ChildProcess | null = null;
let activeCarsBgSyncController: ReadableStreamDefaultController<Uint8Array> | null = null;
let activeCarsBgSyncEncoder: TextEncoder | null = null;

function isChildRunning(child: ChildProcess | null) {
  if (!child) return false;
  return child.exitCode === null && child.signalCode === null;
}

function sendActiveEvent(data: object) {
  if (!activeCarsBgSyncController || !activeCarsBgSyncEncoder) return;
  try {
    activeCarsBgSyncController.enqueue(activeCarsBgSyncEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Ignore enqueue errors after disconnect/close.
  }
}

function clearActiveCarsBgSync(child: ChildProcess) {
  if (activeCarsBgSyncChild === child) {
    activeCarsBgSyncChild = null;
    activeCarsBgSyncController = null;
    activeCarsBgSyncEncoder = null;
  }
}

function clearStaleActiveCarsBgSync() {
  if (activeCarsBgSyncChild && !isChildRunning(activeCarsBgSyncChild)) {
    activeCarsBgSyncChild = null;
    activeCarsBgSyncController = null;
    activeCarsBgSyncEncoder = null;
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null) as { live?: boolean; dealers?: string[] } | null;

  clearStaleActiveCarsBgSync();

  if (activeCarsBgSyncChild) {
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

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: object) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Ignore enqueue errors after disconnect/close.
        }
      };

      const child = spawn(
        path.join(process.cwd(), 'node_modules/.bin/tsx'),
        [
          path.join(process.cwd(), 'scraper/scripts/run-carsbg-sync.ts'),
          ...scriptArgs,
        ],
        { env: process.env },
      );

      activeCarsBgSyncChild = child;
      activeCarsBgSyncController = controller;
      activeCarsBgSyncEncoder = enc;

      let stdoutBuffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            send(JSON.parse(line));
          } catch {
            send({ type: 'log', level: 'stderr', message: line });
          }
        }
      });

      let stderrBuffer = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
        const lines = stderrBuffer.split('\n');
        stderrBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim()) send({ type: 'log', level: 'stderr', message: line });
        }
      });

      child.on('close', (code: number | null) => {
        clearActiveCarsBgSync(child);
        send({ type: 'stream_closed', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        clearActiveCarsBgSync(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (activeCarsBgSyncChild === child) {
          sendActiveEvent({ type: 'log', level: 'stderr', message: 'Client disconnected. Stopping cars.bg sync…' });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      clearStaleActiveCarsBgSync();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function DELETE() {
  clearStaleActiveCarsBgSync();

  if (!activeCarsBgSyncChild) {
    return new Response(JSON.stringify({ ok: false, error: 'No cars.bg sync run is currently running' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendActiveEvent({ type: 'log', level: 'stderr', message: 'Stop requested. Terminating cars.bg sync…' });
  const child = activeCarsBgSyncChild;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    setTimeout(() => {
      if (activeCarsBgSyncChild === child && isChildRunning(child)) {
        sendActiveEvent({ type: 'log', level: 'stderr', message: 'Cars.bg sync did not stop in time. Forcing shutdown…' });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    clearStaleActiveCarsBgSync();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
