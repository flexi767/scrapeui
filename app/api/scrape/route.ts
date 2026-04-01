import { NextRequest } from 'next/server';
import { ChildProcess, spawn } from 'child_process';
import path from 'path';

export const runtime = 'nodejs';

let activeScrapeChild: ChildProcess | null = null;
let activeScrapeController: ReadableStreamDefaultController<Uint8Array> | null = null;
let activeScrapeEncoder: TextEncoder | null = null;

function isChildRunning(child: ChildProcess | null) {
  if (!child) return false;
  return child.exitCode === null && child.signalCode === null;
}

function sendActiveEvent(data: object) {
  if (!activeScrapeController || !activeScrapeEncoder) return;
  try {
    activeScrapeController.enqueue(activeScrapeEncoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  } catch {
    // Ignore enqueue errors after disconnect/close.
  }
}

function clearActiveScrape(child: ChildProcess) {
  if (activeScrapeChild === child) {
    activeScrapeChild = null;
    activeScrapeController = null;
    activeScrapeEncoder = null;
  }
}

function clearStaleActiveScrape() {
  if (activeScrapeChild && !isChildRunning(activeScrapeChild)) {
    activeScrapeChild = null;
    activeScrapeController = null;
    activeScrapeEncoder = null;
  }
}

export async function POST(req: NextRequest) {
  const { dealers, deepCrawl, source } = await req.json();

  clearStaleActiveScrape();

  if (activeScrapeChild) {
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

      const child = spawn(path.join(process.cwd(), 'node_modules/.bin/tsx'), [
        path.join(process.cwd(), scriptName),
        ...scriptArgs,
      ], {
        env: {
          ...process.env,
          CRAWLEE_STORAGE_DIR: process.env.CRAWLEE_STORAGE_DIR ?? '/Users/v/dev/scraped/crawlee-storage',
        },
      });

      activeScrapeChild = child;
      activeScrapeController = controller;
      activeScrapeEncoder = enc;

      let buffer = '';

      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            send(obj);
          } catch {
            // ignore non-JSON stdout lines (crawlee internal logs, etc.)
          }
        }
      });

      // Forward stderr as log events (crawlee debug noise, but useful for debugging failures)
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
        clearActiveScrape(child);
        send({ type: 'complete', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        clearActiveScrape(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (activeScrapeChild === child) {
          sendActiveEvent({ type: 'log', level: 'stderr', message: 'Client disconnected. Stopping scraper…' });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      clearStaleActiveScrape();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function DELETE() {
  clearStaleActiveScrape();

  if (!activeScrapeChild) {
    return new Response(JSON.stringify({ ok: false, error: 'No scraper is currently running' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  sendActiveEvent({ type: 'log', level: 'stderr', message: 'Stop requested. Terminating scraper…' });
  const child = activeScrapeChild;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    setTimeout(() => {
      if (activeScrapeChild === child && isChildRunning(child)) {
        sendActiveEvent({ type: 'log', level: 'stderr', message: 'Scraper did not stop in time. Forcing shutdown…' });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    clearStaleActiveScrape();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
