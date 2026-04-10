import { NextRequest } from 'next/server';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

let activeChild: ChildProcess | null = null;
let activeController: ReadableStreamDefaultController<Uint8Array> | null = null;
let activeEncoder: TextEncoder | null = null;

function isChildRunning(child: ChildProcess | null) {
  if (!child) return false;
  return child.exitCode === null && child.signalCode === null;
}

function sendEvent(data: object) {
  if (!activeController || !activeEncoder) return;
  try {
    activeController.enqueue(activeEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Ignore enqueue errors after disconnect/close.
  }
}

function clearActive(child: ChildProcess) {
  if (activeChild === child) {
    activeChild = null;
    activeController = null;
    activeEncoder = null;
  }
}

function clearStale() {
  if (activeChild && !isChildRunning(activeChild)) {
    activeChild = null;
    activeController = null;
    activeEncoder = null;
  }
}

export async function POST(req: NextRequest) {
  clearStale();

  if (activeChild) {
    return new Response(JSON.stringify({ error: 'A renew & reset run is already in progress' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let dealerSlugs: string[] = [];
  let onlyReset = false;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (Array.isArray(body.dealerSlugs)) {
      dealerSlugs = (body.dealerSlugs as unknown[]).filter((s): s is string => typeof s === 'string' && s.length > 0);
    }
    if (body.onlyReset === true) {
      onlyReset = true;
    }
  } catch {
    // ignore
  }

  if (dealerSlugs.length === 0) {
    return new Response(JSON.stringify({ error: 'dealerSlugs is required' }), {
      status: 400,
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

      const args = [path.join(process.cwd(), 'scraper/scripts/run-own-renew-reset.ts')];
      for (const slug of dealerSlugs) {
        args.push('--dealer', slug);
      }
      if (onlyReset) {
        args.push('--only-reset');
      }

      const child = spawn(
        path.join(process.cwd(), 'node_modules/.bin/tsx'),
        args,
        { env: process.env },
      );

      activeChild = child;
      activeController = controller;
      activeEncoder = enc;

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
        clearActive(child);
        send({ type: 'stream_closed', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        clearActive(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (activeChild === child) {
          sendEvent({ type: 'log', level: 'stderr', message: 'Client disconnected. Stopping…' });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      clearStale();
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
  clearStale();

  if (!activeChild) {
    return new Response(JSON.stringify({ ok: false, error: 'No renew & reset run is currently running' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendEvent({ type: 'log', level: 'stderr', message: 'Stop requested. Terminating…' });
  const child = activeChild;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    setTimeout(() => {
      if (activeChild === child && isChildRunning(child)) {
        sendEvent({ type: 'log', level: 'stderr', message: 'Did not stop in time. Forcing shutdown…' });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    clearStale();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
