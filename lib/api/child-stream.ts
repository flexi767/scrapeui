import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import { requireAuth } from '@/lib/api/auth-helpers';
import { logger } from '@/lib/logger';

const log = logger.child('scrape');
const MAX_CHILD_JOB_MS = 15 * 60 * 1000; // 15 minutes
// Ring buffer of events kept for clients that (re)attach mid-run. Sized for
// the chattiest jobs (deep scrapes log per listing); ~a few hundred bytes each.
const MAX_BUFFERED_EVENTS = 5000;

type StreamController = ReadableStreamDefaultController<Uint8Array>;

/**
 * In-memory state for one job type: at most one running child process, plus
 * any number of SSE subscribers. The job's lifetime is owned by the child
 * process and the DELETE endpoint — never by a subscriber's connection.
 *
 * SINGLE-NODE ONLY (see CLAUDE.md — Architecture Constraints).
 */
export class ChildStreamState {
  private _child: ChildProcess | null = null;
  private readonly _controllers = new Set<StreamController>();
  private _buffer: Uint8Array[] = [];
  private readonly encoder = new TextEncoder();

  get child(): ChildProcess | null {
    return this._child;
  }

  isRunning(): boolean {
    if (!this._child) return false;
    if (this._child.killed) return false;
    return this._child.exitCode === null && this._child.signalCode === null;
  }

  activate(child: ChildProcess): void {
    this._child = child;
    this._buffer = [];
  }

  /** Add an SSE subscriber, replaying everything the job has emitted so far. */
  subscribe(controller: StreamController): void {
    for (const chunk of this._buffer) {
      try {
        controller.enqueue(chunk);
      } catch {
        return; // Subscriber already gone.
      }
    }
    this._controllers.add(controller);
  }

  unsubscribe(controller: StreamController): void {
    this._controllers.delete(controller);
  }

  send(data: object): void {
    const chunk = this.encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    this._buffer.push(chunk);
    if (this._buffer.length > MAX_BUFFERED_EVENTS) this._buffer.shift();

    for (const controller of this._controllers) {
      try {
        controller.enqueue(chunk);
      } catch {
        this._controllers.delete(controller);
      }
    }
  }

  /** Close all subscriber streams (job finished or errored). */
  closeAll(): void {
    for (const controller of this._controllers) {
      try {
        controller.close();
      } catch {
        // Ignore close errors after disconnect/close.
      }
    }
    this._controllers.clear();
  }

  clearIfDone(child: ChildProcess): void {
    if (this._child === child) {
      this._child = null;
    }
  }

  clearStale(): void {
    if (this._child && !this.isRunning()) {
      this._child = null;
    }
  }
}

export interface SseStreamOptions {
  closeEventType?: string;
  env?: NodeJS.ProcessEnv;
  silentNonJsonStdout?: boolean;
}

export interface ChildJobRouteDefinition {
  prepare: (req: Request) => Promise<ChildJobRun | Response> | ChildJobRun | Response;
  stopMessages: {
    notRunning: string;
    stopping: string;
    forcingShutdown: string;
  };
}

export interface ChildJobRun {
  scriptArgs?: string[];
  scriptPath: string;
  options?: SseStreamOptions;
}

/**
 * Spawn the worker and wire its output into `state`. The child's lifetime is
 * independent of any HTTP connection: subscribers may come and go, and the
 * job keeps running until it finishes, errors, hits the watchdog, or is
 * stopped explicitly via DELETE.
 */
function startChildJob(
  state: ChildStreamState,
  scriptPath: string,
  scriptArgs: string[],
  options?: SseStreamOptions,
): void {
  const child = spawn(
    path.join(process.cwd(), 'node_modules/.bin/tsx'),
    [scriptPath, ...scriptArgs],
    { env: options?.env ?? process.env },
  );

  state.activate(child);

  const watchdog = setTimeout(() => {
    if (state.child === child && state.isRunning()) {
      log.warn('Job exceeded max runtime; killing', { scriptPath, maxMs: MAX_CHILD_JOB_MS });
      state.send({ type: 'log', level: 'stderr', message: 'Job exceeded max runtime; stopping.' });
      child.kill('SIGKILL');
    }
  }, MAX_CHILD_JOB_MS);
  watchdog.unref();

  let stdoutBuffer = '';
  child.stdout.on('data', (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        state.send(JSON.parse(line));
      } catch {
        if (!options?.silentNonJsonStdout) {
          state.send({ type: 'log', level: 'stderr', message: line });
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
      if (line.trim()) state.send({ type: 'log', level: 'stderr', message: line });
    }
  });

  child.on('close', (code: number | null) => {
    clearTimeout(watchdog);
    log.info('Child process closed', { code, script: scriptPath });
    state.clearIfDone(child);
    state.send({ type: options?.closeEventType ?? 'stream_closed', code });
    state.closeAll();
  });

  child.on('error', (err: Error) => {
    clearTimeout(watchdog);
    log.error('Child process error', err.message);
    state.clearIfDone(child);
    state.send({ type: 'error', message: err.message });
    state.closeAll();
  });
}

/**
 * SSE response that observes the running job. Closing it (tab close, abort,
 * navigation) only detaches this subscriber — the job keeps running.
 */
function createAttachResponse(req: Request, state: ChildStreamState): Response {
  let subscriber: StreamController | null = null;

  const stream = new ReadableStream({
    start(controller) {
      subscriber = controller;
      state.subscribe(controller);

      // If the job already finished while we were attaching, end the stream.
      if (!state.isRunning()) {
        state.unsubscribe(controller);
        try {
          controller.close();
        } catch {
          // Ignore close errors after disconnect/close.
        }
        return;
      }

      req.signal.addEventListener('abort', () => {
        state.unsubscribe(controller);
      });
    },
    cancel() {
      if (subscriber) state.unsubscribe(subscriber);
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

export function createChildJobRoute(definition: ChildJobRouteDefinition) {
  const state = new ChildStreamState();

  return {
    async POST(req: Request) {
      const check = await requireAuth();
      if ('error' in check) return check.error;

      state.clearStale();

      // A job is already running: attach to it (with replay) instead of
      // starting another or failing. The request body is ignored.
      if (state.isRunning()) {
        return createAttachResponse(req, state);
      }

      const run = await definition.prepare(req);
      if (run instanceof Response) return run;

      startChildJob(
        state,
        path.isAbsolute(run.scriptPath) ? run.scriptPath : path.join(process.cwd(), run.scriptPath),
        run.scriptArgs ?? [],
        run.options,
      );

      return createAttachResponse(req, state);
    },

    async DELETE() {
      const check = await requireAuth();
      if ('error' in check) return check.error;

      return createStopResponse(state, definition.stopMessages);
    },
  };
}
