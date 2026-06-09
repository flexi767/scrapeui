import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

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

export function canAccessDealer(session: Session, dealerId: number): boolean {
  return session.user.role === 'admin' || session.user.dealerId === dealerId;
}

export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}
