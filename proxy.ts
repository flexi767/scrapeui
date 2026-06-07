import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { getDealerByDomain } from '@/lib/query-modules/public';
import { locales, defaultLocale } from '@/i18n/routing';

const cache = new Map<string, string | null>();
const cacheExpiry = new Map<string, number>();
const CACHE_TTL_MS = 60_000;

function cachedDealerSlug(host: string): string | null {
  const now = Date.now();
  if (cache.has(host) && (cacheExpiry.get(host) ?? 0) > now) {
    return cache.get(host) ?? null;
  }

  cache.delete(host);
  cacheExpiry.delete(host);

  const dealer = getDealerByDomain(host);
  const slug = dealer?.slug ?? null;
  cache.set(host, slug);
  cacheExpiry.set(host, now + CACHE_TTL_MS);
  return slug;
}

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!session?.user;

      // Strip locale prefix to check the real path
      const pathnameWithoutLocale = locales.reduce(
        (p, locale) => p.replace(new RegExp(`^/${locale}`), '') || '/',
        pathname
      );

      const isLoginPage = pathnameWithoutLocale === '/login' || pathnameWithoutLocale.startsWith('/login');
      const isApiAuth = pathname.startsWith('/api/auth');
      const isPublicDealerPage = pathnameWithoutLocale.startsWith('/d/');
      const isTokenCheckedBackupImage = pathname.startsWith('/api/mobilebg-backup-images/');

      if (isLoginPage || isApiAuth || isPublicDealerPage || isTokenCheckedBackupImage) return true;

      const host = (request.headers.get('host') ?? '').split(':')[0];
      const slug = cachedDealerSlug(host);
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/d/${slug}${pathnameWithoutLocale === '/' ? '' : pathnameWithoutLocale}`;
        return NextResponse.rewrite(url);
      }

      return isLoggedIn;
    },
  },
});

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for API routes, Next internals, and static assets
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/_vercel/') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Run intl middleware first (handles locale detection and redirect)
  const intlResponse = intlMiddleware(request);

  // If intl wants to redirect (e.g. / → /bg), let it
  if (intlResponse.status === 307 || intlResponse.status === 308) {
    return intlResponse;
  }

  // Then run auth check
  return (auth as any)(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
