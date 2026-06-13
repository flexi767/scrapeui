import { describe, expect, it } from 'vitest';
import { InMemoryJobQueue } from '@/lib/queue/job-queue';

describe('InMemoryJobQueue', () => {
  it('deduplicates queued jobs by key', () => {
    const queue = new InMemoryJobQueue<{ id: number }>({ concurrency: 1, maxQueued: 10 });
    const first = queue.enqueue({ id: 1 }, { dedupeKey: 'dealer:1' });
    const second = queue.enqueue({ id: 2 }, { dedupeKey: 'dealer:1' });

    expect(first).not.toBeInstanceOf(Response);
    expect(second).toBe(first);
    expect(queue.stats()).toMatchObject({ queued: 1, running: 0, total: 1 });
  });

  it('returns a 429 response when the queue is full', () => {
    const queue = new InMemoryJobQueue({ concurrency: 1, maxQueued: 1 });
    queue.enqueue({ id: 1 });
    const result = queue.enqueue({ id: 2 });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(429);
  });

  it('runs queued work and records completion', async () => {
    const queue = new InMemoryJobQueue<{ id: number }>({ concurrency: 1, maxQueued: 10 });
    const job = queue.enqueue({ id: 1 });
    if (job instanceof Response) throw new Error('unexpected response');

    await queue.drain(async () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queue.get(job.id)?.status).toBe('succeeded');
    expect(queue.stats()).toMatchObject({ queued: 0, running: 0, total: 1 });
  });
});
