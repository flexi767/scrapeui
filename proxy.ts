import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import { getDealerByDomain } from '@/lib/query-modules/public';

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

const { auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized({ auth: session, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!session?.user;
      const isLoginPage = pathname === '/login';
      const isApiAuth = pathname.startsWith('/api/auth');
      const isPublicDealerPage = pathname.startsWith('/d/');

      if (isLoginPage || isApiAuth || isPublicDealerPage) return true;

      const host = (request.headers.get('host') ?? '').split(':')[0];
      const slug = cachedDealerSlug(host);
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/d/${slug}${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(url);
      }

      return isLoggedIn;
    },
  },
});

export default auth;

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
