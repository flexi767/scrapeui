import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';
import { fetchMakesModels } from '@/lib/mobile-bg/makes-models';
import { loadMobileBgMakesMapFromDb } from '@/lib/mobile-bg/reference';

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const pubtype = req.nextUrl.searchParams.get('pubtype') ?? '1,2';
  const map = loadMobileBgMakesMapFromDb(raw, { pubtype }) ?? await fetchMakesModels(pubtype);
  const makes = Array.from(map.values()).sort((a, b) => a.make.localeCompare(b.make, 'bg'));
  return NextResponse.json(makes, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
