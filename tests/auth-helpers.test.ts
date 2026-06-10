import { describe, it, expect, vi } from 'vitest';

// Mock @/lib/auth before any import that might transitively load it.
// auth-helpers.ts calls `auth()` inside its async functions, but canAccessDealer
// is a pure synchronous predicate — we just need the module to load cleanly.
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

// next/server is used by auth-helpers for NextResponse; mock it too so there's
// no dependency on a Next.js runtime in the test environment.
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 })),
  },
}));

import { canAccessDealer } from '@/lib/api/auth-helpers';
import type { Session } from 'next-auth';

// Minimal session builder — typed against the augmented Session in lib/auth.ts
function makeSession(overrides: Partial<Session['user']>): Session {
  return {
    expires: '2099-01-01T00:00:00.000Z',
    user: {
      id: '1',
      name: 'Test User',
      username: 'testuser',
      role: 'user',
      dealerId: null,
      pageKeys: [],
      ...overrides,
    },
  } as unknown as Session;
}

describe('canAccessDealer', () => {
  it('admin role passes for any dealerId', () => {
    const session = makeSession({ role: 'admin', dealerId: null });
    expect(canAccessDealer(session, 42)).toBe(true);
    expect(canAccessDealer(session, 99)).toBe(true);
    expect(canAccessDealer(session, 1)).toBe(true);
  });

  it('non-admin whose dealerId matches passes', () => {
    const session = makeSession({ role: 'user', dealerId: 7 });
    expect(canAccessDealer(session, 7)).toBe(true);
  });

  it('non-admin with a different dealerId fails', () => {
    const session = makeSession({ role: 'user', dealerId: 7 });
    expect(canAccessDealer(session, 99)).toBe(false);
  });

  it('non-admin with null dealerId fails for any dealerId', () => {
    const session = makeSession({ role: 'user', dealerId: null });
    expect(canAccessDealer(session, 1)).toBe(false);
  });

  it('non-admin with dealerId 0 does not match dealerId 1', () => {
    const session = makeSession({ role: 'user', dealerId: 0 });
    expect(canAccessDealer(session, 1)).toBe(false);
  });
});
