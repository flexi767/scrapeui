import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Every API route must either call one of the auth helpers or be explicitly
 * listed as public below. The middleware (proxy.ts) skips /api/ entirely, so
 * a route without an in-file auth check is reachable by anyone.
 */
const AUTH_MARKERS = [
  'requireAuth',
  'requireAdmin',
  'requireDealerScope',
  'requirePagePermission',
  'requireApiPagePermission',
  // createChildJobRoute performs requireAuth() inside its POST/DELETE handlers.
  'createChildJobRoute',
  // Signed, expiring asset tokens replace session auth for <img> URLs.
  'verifySignedAssetToken',
];

/** Routes that are public by design. Adding to this list is a reviewed decision. */
const PUBLIC_ROUTES: string[] = [
  // NextAuth's own sign-in/session endpoints.
  'app/api/auth/[...nextauth]/route.ts',
  // Public dealer self-registration form.
  'app/api/dealers/self-register/route.ts',
  // Serves the bookmarklet JS that runs on facebook.com (CORS *).
  'app/api/facebook-marketplace/bookmarklet/route.ts',
  // Static image/file serving used in <img> tags; path-traversal guarded.
  'app/api/images/[...path]/route.ts',
  'app/api/thumbs/[mobileId]/route.ts',
  'app/api/uploads/[filename]/route.ts',
  // Rate-limited contact form on public dealer pages.
  'app/api/public/enquiry/route.ts',
];

const ROOT = path.resolve(__dirname, '..');

describe('API auth coverage', () => {
  const routeFiles = readdirSync(path.join(ROOT, 'app/api'), { recursive: true })
    .map(String)
    .filter((file) => file === 'route.ts' || file.endsWith('/route.ts'))
    .map((file) => path.join('app/api', file))
    .sort();

  it('finds API routes', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it.each(routeFiles)('%s declares auth or is explicitly public', (file) => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    const hasAuthMarker = AUTH_MARKERS.some((marker) => source.includes(marker));
    const isPublic = PUBLIC_ROUTES.includes(file);

    expect(
      hasAuthMarker || isPublic,
      `${file} has no auth check and is not in PUBLIC_ROUTES — unauthenticated by accident?`,
    ).toBe(true);
  });

  it('PUBLIC_ROUTES entries all exist and none secretly has auth', () => {
    for (const file of PUBLIC_ROUTES) {
      expect(routeFiles, `${file} listed as public but does not exist`).toContain(file);
      const source = readFileSync(path.join(ROOT, file), 'utf8');
      const hasAuthMarker = AUTH_MARKERS.some((marker) => source.includes(marker));
      expect(
        hasAuthMarker,
        `${file} is in PUBLIC_ROUTES but contains an auth marker — remove it from the list`,
      ).toBe(false);
    }
  });
});
