import { NextRequest } from 'next/server';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

let activeSearchRanksChild: ChildProcess | null = null;
let activeSearchRanksController: ReadableStreamDefaultController<Uint8Array> | null = null;
let activeSearchRanksEncoder: TextEncoder | null = null;

function isChildRunning(child: ChildProcess | null) {
  if (!child) return false;
  return child.exitCode === null && child.signalCode === null;
}

function sendActiveEvent(data: object) {
  if (!activeSearchRanksController || !activeSearchRanksEncoder) return;
  try {
    activeSearchRanksController.enqueue(activeSearchRanksEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Ignore enqueue errors after disconnect/close.
  }
}

function clearActiveSearchRanks(child: ChildProcess) {
  if (activeSearchRanksChild === child) {
    activeSearchRanksChild = null;
    activeSearchRanksController = null;
    activeSearchRanksEncoder = null;
  }
}

function clearStaleActiveSearchRanks() {
  if (activeSearchRanksChild && !isChildRunning(activeSearchRanksChild)) {
    activeSearchRanksChild = null;
    activeSearchRanksController = null;
    activeSearchRanksEncoder = null;
  }
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null) as { missingOnly?: boolean } | null;

  clearStaleActiveSearchRanks();

  if (activeSearchRanksChild) {
    return new Response(JSON.stringify({ error: 'A search-position run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const scriptArgs: string[] = [];
  if (payload?.missingOnly === true) {
    scriptArgs.push('--missing-only');
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
          path.join(process.cwd(), 'scraper/scripts/run-own-search-ranks.ts'),
          ...scriptArgs,
        ],
        {
          env: process.env,
        },
      );

      activeSearchRanksChild = child;
      activeSearchRanksController = controller;
      activeSearchRanksEncoder = enc;

      let stdoutBuffer = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            send(obj);
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
        clearActiveSearchRanks(child);
        send({ type: 'stream_closed', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        clearActiveSearchRanks(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (activeSearchRanksChild === child) {
          sendActiveEvent({ type: 'log', level: 'stderr', message: 'Client disconnected. Stopping search-position run…' });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      clearStaleActiveSearchRanks();
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
  clearStaleActiveSearchRanks();

  if (!activeSearchRanksChild) {
    return new Response(JSON.stringify({ ok: false, error: 'No search-position run is currently running' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendActiveEvent({ type: 'log', level: 'stderr', message: 'Stop requested. Terminating search-position run…' });
  const child = activeSearchRanksChild;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    setTimeout(() => {
      if (activeSearchRanksChild === child && isChildRunning(child)) {
        sendActiveEvent({ type: 'log', level: 'stderr', message: 'Search-position run did not stop in time. Forcing shutdown…' });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    clearStaleActiveSearchRanks();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
