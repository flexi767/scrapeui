import { describe, expect, it, vi } from 'vitest';
import { createSharedCache } from '@/lib/cache/shared-cache';

describe('createSharedCache', () => {
  it('namespaces values and deletes by prefix', () => {
    const cache = createSharedCache<number>({ namespace: 'test', ttlMs: 60_000, maxEntries: 10 });
    const compute = vi.fn((value: number) => value);

    cache.set('dealer:1:listings:a', 1);
    cache.set('dealer:1:listings:b', 2);
    cache.set('dealer:2:listings:a', 3);

    cache.deleteByPrefix('dealer:1:');

    expect(cache.peek('dealer:1:listings:a')).toBeUndefined();
    expect(cache.peek('dealer:1:listings:b')).toBeUndefined();
    expect(cache.peek('dealer:2:listings:a')).toBe(3);
    expect(cache.get('computed', () => compute(4))).toBe(4);
    expect(cache.get('computed', () => compute(5))).toBe(4);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
