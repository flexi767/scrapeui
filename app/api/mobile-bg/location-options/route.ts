import { NextResponse } from 'next/server';
import { fetchSubLocationOptions } from '@/lib/mobile-bg/location-options';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = (searchParams.get('location') || '').trim();
    const result = await fetchSubLocationOptions(location);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Failed to load location options' }, { status: 500 });
  }
}
