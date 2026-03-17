import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe auth config. No Node.js imports (no fs, no better-sqlite3).
 * Used by middleware for JWT verification only.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isLoginPage = request.nextUrl.pathname === '/login';
      const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth');

      if (isLoginPage || isApiAuth) return true;
      if (!isLoggedIn) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role?: string }).role ?? 'user';
        token.username = (user as { username?: string }).username ?? '';
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as unknown as Record<string, unknown>).role = token.role;
      (session.user as unknown as Record<string, unknown>).username = token.username;
      return session;
    },
  },
  providers: [], // providers added in auth.ts (Node runtime only)
  session: { strategy: 'jwt' },
} satisfies NextAuthConfig;
