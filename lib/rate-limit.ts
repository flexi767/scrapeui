// In-memory fixed-window rate limiter.
// NOTE: Per-process only — state is NOT shared across workers or restarts.
// Suitable for single-node deployments (this app is single-node by design).

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, Window>();

const SWEEP_THRESHOLD = 5000;

function sweep(): void {
  const now = Date.now();
  for (const [key, win] of store) {
    if (now > win.resetAt) store.delete(key);
  }
}

/**
 * Returns { allowed: true } if the caller is within the rate limit,
 * or { allowed: false, retryAfterSec } if the window is exhausted.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();

  // Opportunistically sweep expired entries when the map grows large.
  if (store.size > SWEEP_THRESHOLD) sweep();

  const existing = store.get(key);

  if (!existing || now > existing.resetAt) {
    // Start a fresh window.
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  existing.count += 1;

  if (existing.count <= opts.limit) {
    return { allowed: true, retryAfterSec: 0 };
  }

  const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
  return { allowed: false, retryAfterSec };
}

/**
 * Extracts the client IP from a Request.
 * Reads x-forwarded-for (first entry) or x-real-ip, falling back to 'unknown'.
 * NOTE: In a single-node deployment behind a trusted reverse-proxy these headers
 * are reliable; in other environments they can be spoofed.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}
