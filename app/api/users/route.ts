import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { getAllUsers } from '@/lib/queries';

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  return NextResponse.json(getAllUsers());
}
