import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getAllLabels } from '@/lib/queries';
import { runInsert } from '@/lib/listings/sql';

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  return NextResponse.json(getAllLabels());
}

export async function POST(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const { name, color = '#6b7280' } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = runInsert(raw, 'labels', { name: name.trim(), color });
  return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), color }, { status: 201 });
}
