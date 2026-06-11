import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientIp, rateLimit } from '@/lib/rate-limit';

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimit', () => {
  it('allows requests until the fixed window limit is reached', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    expect(rateLimit('rl:test', { limit: 2, windowMs: 1_000 })).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
    expect(rateLimit('rl:test', { limit: 2, windowMs: 1_000 })).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
    expect(rateLimit('rl:test', { limit: 2, windowMs: 1_000 })).toEqual({
      allowed: false,
      retryAfterSec: 1,
    });
  });

  it('starts a fresh window after reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);

    expect(rateLimit('rl:reset', { limit: 1, windowMs: 1_000 }).allowed).toBe(true);
    expect(rateLimit('rl:reset', { limit: 1, windowMs: 1_000 }).allowed).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(rateLimit('rl:reset', { limit: 1, windowMs: 1_000 })).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });
});

describe('clientIp', () => {
  it('uses the first forwarded address', () => {
    const req = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
    });

    expect(clientIp(req)).toBe('203.0.113.10');
  });

  it('falls back to x-real-ip and then unknown', () => {
    const realIpReq = new Request('https://example.com', {
      headers: { 'x-real-ip': '198.51.100.4' },
    });
    const unknownReq = new Request('https://example.com');

    expect(clientIp(realIpReq)).toBe('198.51.100.4');
    expect(clientIp(unknownReq)).toBe('unknown');
  });
});
