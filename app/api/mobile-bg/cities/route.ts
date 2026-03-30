import { NextRequest, NextResponse } from 'next/server';
import { fetchCitiesForRegion } from '@/lib/mobile-bg/regions';

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get('region');
  if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });
  try {
    const cities = await fetchCitiesForRegion(region);
    return NextResponse.json(cities, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
