import { afterEach, describe, expect, it, vi } from 'vitest';

// child-stream.ts pulls in requireAuth → @/lib/auth (NextAuth). Mock the auth
// boundary so tests exercise the process/stream machinery, not sessions.
vi.mock('@/lib/api/auth-helpers', () => ({
  requireAuth: vi.fn(async () => ({ session: { user: { id: '1', role: 'admin' } } })),
}));

import { createChildJobRoute } from '@/lib/api/child-stream';

const FIXTURE = 'tests/fixtures/slow-emitter.ts';

interface SseEvent {
  type: string;
  message?: string;
  code?: number | null;
}

function makeRoute(ticks = 20) {
  return createChildJobRoute({
    prepare: () => ({ scriptPath: FIXTURE, scriptArgs: [String(ticks)] }),
    stopMessages: {
      notRunning: 'not running',
      stopping: 'stopping',
      forcingShutdown: 'forcing shutdown',
    },
  });
}

function postRequest(signal?: AbortSignal): Request {
  return new Request('http://test.local/api/job', { method: 'POST', signal });
}

/** Read SSE events from a response until `predicate` matches or the stream ends. */
async function readEventsUntil(
  response: Response,
  predicate: (events: SseEvent[]) => boolean,
  timeoutMs = 15_000,
): Promise<SseEvent[]> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: SseEvent[] = [];
  let buffer = '';
  const deadline = Date.now() + timeoutMs;

  try {
    while (!predicate(events)) {
      if (Date.now() > deadline) throw new Error(`Timed out; got: ${JSON.stringify(events)}`);
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (line.startsWith('data: ')) events.push(JSON.parse(line.slice(6)) as SseEvent);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return events;
}

const ticksSeen = (events: SseEvent[]) =>
  events.filter((e) => e.type === 'log' && e.message?.startsWith('tick')).map((e) => e.message);

const tickPids = (events: SseEvent[]) =>
  new Set(ticksSeen(events).map((message) => message!.match(/pid (\d+)/)![1]));

const tickNumbers = (events: SseEvent[]) =>
  ticksSeen(events).map((message) => Number(message!.match(/^tick (\d+)/)![1]));

describe('createChildJobRoute', () => {
  // Forcibly stop any job a test leaves behind.
  let cleanup: (() => Promise<void>) | null = null;
  afterEach(async () => {
    await cleanup?.();
    cleanup = null;
  });

  it('streams events and finishes with a close event', async () => {
    const route = makeRoute(2);
    cleanup = async () => void (await route.DELETE());

    const response = await route.POST(postRequest());
    expect(response.status).toBe(200);
    const events = await readEventsUntil(response, (e) => e.some((ev) => ev.type === 'stream_closed'));

    expect(tickNumbers(events)).toContain(0);
    expect(events.at(-1)).toMatchObject({ type: 'stream_closed', code: 0 });
  }, 20_000);

  it('keeps the job running when the client disconnects, and a re-POST attaches with replay', async () => {
    const route = makeRoute(15);
    cleanup = async () => void (await route.DELETE());

    // First client: read a couple of ticks, then vanish.
    const abort = new AbortController();
    const first = await route.POST(postRequest(abort.signal));
    const firstEvents = await readEventsUntil(first, (e) => ticksSeen(e).length >= 2);
    const [firstPid] = tickPids(firstEvents);
    abort.abort();
    await first.body!.cancel().catch(() => {});

    // Give the abort a moment to propagate; the child must survive it.
    await new Promise((r) => setTimeout(r, 300));

    // Second client: re-POST attaches to the running job instead of 409,
    // replays earlier ticks, and follows it to completion.
    const second = await route.POST(postRequest());
    expect(second.status).toBe(200);
    const events = await readEventsUntil(second, (e) => e.some((ev) => ev.type === 'stream_closed'));

    // Same worker process throughout — not a kill-and-restart.
    expect(tickPids(events)).toEqual(new Set([firstPid]));
    expect(tickNumbers(events)).toContain(0); // replayed from before the disconnect
    expect(tickNumbers(events)).toContain(14); // produced after the disconnect
    expect(events.at(-1)).toMatchObject({ type: 'stream_closed', code: 0 });
  }, 20_000);

  it('DELETE stops a running job', async () => {
    const route = makeRoute(50);

    const response = await route.POST(postRequest());
    await readEventsUntil(response, (e) => ticksSeen(e).length >= 1);

    const stop = await route.DELETE();
    expect(stop.status).toBe(200);

    const events = await readEventsUntil(response, (e) => e.some((ev) => ev.type === 'stream_closed'));
    const closeEvent = events.at(-1)!;
    expect(closeEvent.type).toBe('stream_closed');
    expect(closeEvent.code).not.toBe(0); // killed, not completed
  }, 20_000);
});
