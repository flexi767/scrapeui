import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTtlCache } from '@/lib/ttl-cache';

afterEach(() => {
  vi.useRealTimers();
});

describe('createTtlCache', () => {
  it('returns cached values until the TTL expires', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    const cache = createTtlCache<number>({ ttlMs: 100, maxEntries: 10 });
    const compute = vi.fn(() => 42);

    expect(cache.get('answer', compute)).toBe(42);
    expect(cache.get('answer', compute)).toBe(42);
    expect(compute).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(101);

    expect(cache.peek('answer')).toBeUndefined();
    expect(cache.get('answer', compute)).toBe(42);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest entry when maxEntries is exceeded', () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 2 });

    cache.set('a', 'first');
    cache.set('b', 'second');
    cache.set('c', 'third');

    expect(cache.peek('a')).toBeUndefined();
    expect(cache.peek('b')).toBe('second');
    expect(cache.peek('c')).toBe('third');
  });

  it('refreshes insertion order when setting an existing key', () => {
    const cache = createTtlCache<string>({ ttlMs: 60_000, maxEntries: 2 });

    cache.set('a', 'first');
    cache.set('b', 'second');
    cache.set('a', 'updated');
    cache.set('c', 'third');

    expect(cache.peek('a')).toBe('updated');
    expect(cache.peek('b')).toBeUndefined();
    expect(cache.peek('c')).toBe('third');
  });
});
