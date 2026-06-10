import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { getAllLabels } from '@/lib/queries';
import { runInsert } from '@/lib/listings/sql';

const CreateLabelSchema = z.object({
  name: z.string().optional(),
  color: z.string().optional(),
}).passthrough();

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;
  return NextResponse.json(getAllLabels());
}

export async function POST(request: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const rawBody = await request.json();
  const parsed = CreateLabelSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, color = '#6b7280' } = parsed.data;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const result = runInsert(raw, 'labels', { name: name.trim(), color });
  return NextResponse.json({ id: result.lastInsertRowid, name: name.trim(), color }, { status: 201 });
}
