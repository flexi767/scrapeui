import { NextResponse } from 'next/server';
import {
  DEFAULT_SUB_LOCATION_OPTIONS,
  fetchSubLocationOptions,
} from '@/lib/mobile-bg/location-options';
import { logger } from '@/lib/logger';

const log = logger.child('mobilebg');

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = (searchParams.get('location') || '').trim();
    const result = await fetchSubLocationOptions(location);
    return NextResponse.json(result);
  } catch (error) {
    log.warn('Falling back to default location options:', error);
    return NextResponse.json(DEFAULT_SUB_LOCATION_OPTIONS);
  }
}
