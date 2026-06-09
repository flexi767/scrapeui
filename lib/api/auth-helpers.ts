import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { isPageKey, userHasPageKey, type PageKey } from '@/lib/page-permissions';

type AuthOk = { session: Session };
type AuthErr = { error: NextResponse };

export async function requireAuth(): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { session: session as Session };
}

export async function requireAdmin(): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session: session as Session };
}

type PageAuthOk = { session: Session };
type PageAuthErr = { redirect: string };

/**
 * Server-component page guard. Returns `{ session }` when the signed-in
 * user may see `pageKey`, or `{ redirect: '/dashboard' }` otherwise.
 * Admins always pass.
 */
export async function requirePagePermission(pageKey: PageKey): Promise<PageAuthOk | PageAuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { redirect: '/login' };
  }
  if (session.user.role === 'admin') {
    return { session: session as Session };
  }
  if (!userHasPageKey(session.user.pageKeys, pageKey)) {
    return { redirect: '/dashboard' };
  }
  return { session: session as Session };
}

/**
 * API route guard mirroring requireAdmin's shape: returns `{ session }`
 * or `{ error: NextResponse }` (401/403). Admins always pass.
 */
export async function requireApiPagePermission(pageKey: PageKey): Promise<AuthOk | AuthErr> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.user.role === 'admin') {
    return { session: session as Session };
  }
  if (!userHasPageKey(session.user.pageKeys, pageKey)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session: session as Session };
}

export { isPageKey };
