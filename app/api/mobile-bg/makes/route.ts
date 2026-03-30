import { NextRequest, NextResponse } from 'next/server';
import { fetchMakesModels } from '@/lib/mobile-bg/makes-models';

export async function GET(req: NextRequest) {
  const pubtype = req.nextUrl.searchParams.get('pubtype') ?? '1,2';
  const map = await fetchMakesModels(pubtype);
  const makes = Array.from(map.values()).sort((a, b) => a.make.localeCompare(b.make, 'bg'));
  return NextResponse.json(makes, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
