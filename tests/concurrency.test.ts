import { describe, expect, it } from 'vitest';
import { createConcurrencyGate, withConcurrencyGate } from '@/lib/api/concurrency';

describe('createConcurrencyGate', () => {
  it('rejects acquisition when the limit is reached and releases once done', () => {
    const gate = createConcurrencyGate(1);
    const release = gate.tryAcquire();
    expect(release).toBeTypeOf('function');
    expect(gate.tryAcquire()).toBeNull();
    release?.();
    expect(gate.tryAcquire()).toBeTypeOf('function');
  });

  it('returns a 429 response when wrapped work cannot enter', async () => {
    const gate = createConcurrencyGate(1);
    const release = gate.tryAcquire();
    const result = await withConcurrencyGate(gate, async () => 'ok');
    release?.();

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(429);
  });
});
