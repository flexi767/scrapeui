export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface QueueJob<TPayload = unknown> {
  id: string;
  key: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

export interface EnqueueOptions {
  dedupeKey?: string;
}

export interface InMemoryJobQueueOptions {
  concurrency: number;
  maxQueued: number;
}

export class InMemoryJobQueue<TPayload = unknown> {
  private readonly jobs = new Map<string, QueueJob<TPayload>>();
  private readonly pending: string[] = [];
  private running = 0;
  private nextId = 1;

  constructor(private readonly options: InMemoryJobQueueOptions) {}

  enqueue(payload: TPayload, options: EnqueueOptions = {}): QueueJob<TPayload> | Response {
    const key = options.dedupeKey ?? String(this.nextId);
    const existing = this.findActiveByKey(key);
    if (existing) return existing;

    if (this.pending.length >= this.options.maxQueued) {
      return Response.json(
        { error: 'Queue is full. Please retry shortly.' },
        { status: 429, headers: { 'Retry-After': '10', 'Cache-Control': 'no-store' } },
      );
    }

    const id = String(this.nextId++);
    const job: QueueJob<TPayload> = {
      id,
      key,
      payload,
      status: 'queued',
      attempts: 0,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      error: null,
    };

    this.jobs.set(id, job);
    this.pending.push(id);
    return job;
  }

  async drain(worker: (job: QueueJob<TPayload>) => Promise<void>): Promise<void> {
    while (this.running < this.options.concurrency && this.pending.length > 0) {
      const id = this.pending.shift();
      if (!id) return;
      const job = this.jobs.get(id);
      if (!job || job.status !== 'queued') continue;

      this.running += 1;
      job.status = 'running';
      job.attempts += 1;
      job.startedAt = Date.now();

      void worker(job)
        .then(() => {
          job.status = 'succeeded';
          job.finishedAt = Date.now();
        })
        .catch((error) => {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : String(error);
          job.finishedAt = Date.now();
        })
        .finally(() => {
          this.running = Math.max(0, this.running - 1);
          void this.drain(worker);
        });
    }
  }

  get(id: string): QueueJob<TPayload> | null {
    return this.jobs.get(id) ?? null;
  }

  stats() {
    return {
      queued: this.pending.length,
      running: this.running,
      total: this.jobs.size,
      oldestQueuedAgeMs: this.oldestQueuedAgeMs(),
    };
  }

  private findActiveByKey(key: string): QueueJob<TPayload> | null {
    for (const job of this.jobs.values()) {
      if (job.key === key && (job.status === 'queued' || job.status === 'running')) {
        return job;
      }
    }
    return null;
  }

  private oldestQueuedAgeMs(): number {
    const oldestId = this.pending[0];
    if (!oldestId) return 0;
    const job = this.jobs.get(oldestId);
    return job ? Date.now() - job.createdAt : 0;
  }
}
