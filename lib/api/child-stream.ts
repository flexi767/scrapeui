import { ChildProcess, spawn } from 'child_process';
import path from 'path';

type StreamController = ReadableStreamDefaultController<Uint8Array>;

export class ChildStreamState {
  private _child: ChildProcess | null = null;
  private _controller: StreamController | null = null;
  private readonly encoder = new TextEncoder();

  get child(): ChildProcess | null {
    return this._child;
  }

  isRunning(): boolean {
    if (!this._child) return false;
    if (this._child.killed) return false;
    return this._child.exitCode === null && this._child.signalCode === null;
  }

  activate(child: ChildProcess, controller: StreamController): void {
    this._child = child;
    this._controller = controller;
  }

  send(data: object): void {
    if (!this._controller) return;
    try {
      this._controller.enqueue(this.encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch {
      // Ignore enqueue errors after disconnect/close.
    }
  }

  clearIfDone(child: ChildProcess): void {
    if (this._child === child) {
      this._child = null;
      this._controller = null;
    }
  }

  clearStale(): void {
    if (this._child && !this.isRunning()) {
      this._child = null;
      this._controller = null;
    }
  }
}

export interface SseStreamOptions {
  closeEventType?: string;
  env?: NodeJS.ProcessEnv;
  silentNonJsonStdout?: boolean;
}

export function createSseStreamResponse(
  req: Request,
  state: ChildStreamState,
  scriptPath: string,
  scriptArgs: string[],
  disconnectedMessage: string,
  options?: SseStreamOptions,
): Response {
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
        [scriptPath, ...scriptArgs],
        { env: options?.env ?? process.env },
      );

      state.activate(child, controller);

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
            if (!options?.silentNonJsonStdout) {
              send({ type: 'log', level: 'stderr', message: line });
            }
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
        state.clearIfDone(child);
        send({ type: options?.closeEventType ?? 'stream_closed', code });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      child.on('error', (err: Error) => {
        state.clearIfDone(child);
        send({ type: 'error', message: err.message });
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
      });

      req.signal.addEventListener('abort', () => {
        if (state.child === child) {
          state.send({ type: 'log', level: 'stderr', message: disconnectedMessage });
          child.kill('SIGTERM');
        }
      });
    },
    cancel() {
      state.clearStale();
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

export function createStopResponse(
  state: ChildStreamState,
  messages: {
    notRunning: string;
    stopping: string;
    forcingShutdown: string;
  },
): Response {
  state.clearStale();

  if (!state.child) {
    return new Response(JSON.stringify({ ok: false, error: messages.notRunning }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  state.send({ type: 'log', level: 'stderr', message: messages.stopping });
  const child = state.child;
  const stopped = child.kill('SIGTERM');

  if (stopped) {
    state.clearIfDone(child);
    setTimeout(() => {
      if (state.child === child && state.isRunning()) {
        state.send({ type: 'log', level: 'stderr', message: messages.forcingShutdown });
        child.kill('SIGKILL');
      }
    }, 3000);
  } else {
    state.clearStale();
  }

  return new Response(JSON.stringify({ ok: stopped }), {
    status: stopped ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}
