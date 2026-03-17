import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { raw } from '@/db/client';

declare module 'next-auth' {
  interface User {
    role?: string;
    username?: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
    username: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = raw
          .prepare(
            'SELECT id, username, name, password_hash, role FROM users WHERE username = ?',
          )
          .get(credentials.username as string) as
          | { id: number; username: string; name: string; password_hash: string; role: string }
          | undefined;

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash,
        );
        if (!valid) return null;

        return {
          id: String(user.id),
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
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
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.username = token.username;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
