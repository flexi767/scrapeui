import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helpers';
import { fetchCitiesForRegion } from '@/lib/mobile-bg/regions';
import { errorMessage } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const region = req.nextUrl.searchParams.get('region');
  if (!region) return NextResponse.json({ error: 'region required' }, { status: 400 });
  try {
    const cities = await fetchCitiesForRegion(region);
    return NextResponse.json(cities, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err, 'Failed to load cities') }, { status: 500 });
  }
}
