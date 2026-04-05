import { NextRequest } from 'next/server';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

let activeBatchSyncChild: ChildProcess | null = null;
let activeBatchSyncController: ReadableStreamDefaultController<Uint8Array> | null = null;
let activeBatchSyncEncoder: TextEncoder | null = null;

function isChildRunning(child: ChildProcess | null) {
  if (!child) return false;
  return child.exitCode === null && child.signalCode === null;
}

function sendActiveEvent(data: object) {
  if (!activeBatchSyncController || !activeBatchSyncEncoder) return;
  try {
    activeBatchSyncController.enqueue(activeBatchSyncEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Ignore enqueue errors after disconnect/close.
  }
}

function clearActiveBatchSync(child: ChildProcess) {
  if (activeBatchSyncChild === child) {
    activeBatchSyncChild = null;
    activeBatchSyncController = null;
    activeBatchSyncEncoder = null;
  }
}

function clearStaleActiveBatchSync() {
  if (activeBatchSyncChild && !isChildRunning(activeBatchSyncChild)) {
    activeBatchSyncChild = null;
    activeBatchSyncController = null;
    activeBatchSyncEncoder = null;
  }
}

export async function POST(req: NextRequest) {
  clearStaleActiveBatchSync();

  if (activeBatchSyncChild) {
    return new Response(JSON.stringify({ error: 'A batch sync run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
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
        [path.join(process.cwd(), 'scraper/scripts/run-own-batch-sync.ts')],
        { env: process.env },
      );

      activeBatchSyncChild = child;
      activeBatchSyncController = controller;
      activeBatchSyncEncoder = enc;

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
        clearActiveBatchSync(child);
        send({ type: 'stream_closed', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        clearActiveBatchSync(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (activeBatchSyncChild === child) {
          sendActiveEvent({ type: 'log', level: 'stderr', message: 'Client disconnected. Stopping batch sync…' });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      clearStaleActiveBatchSync();
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
  clearStaleActiveBatchSync();

  if (!activeBatchSyncChild) {
    return new Response(JSON.stringify({ ok: false, error: 'No batch sync run is currently running' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendActiveEvent({ type: 'log', level: 'stderr', message: 'Stop requested. Terminating batch sync…' });
  const child = activeBatchSyncChild;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    setTimeout(() => {
      if (activeBatchSyncChild === child && isChildRunning(child)) {
        sendActiveEvent({ type: 'log', level: 'stderr', message: 'Batch sync did not stop in time. Forcing shutdown…' });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    clearStaleActiveBatchSync();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
