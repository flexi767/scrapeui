import { NextResponse } from 'next/server';
import {
  fetchMobileBgSearchResultsWithFallback,
  type MobileBgSearchFieldInput,
} from '@/lib/mobile-bg/search-results';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as {
      action?: string;
      method?: string;
      fields?: MobileBgSearchFieldInput[];
      sourceMobileId?: string | null;
    } | null;

    if (!payload?.action || !payload?.method || !Array.isArray(payload.fields)) {
      return NextResponse.json({ error: 'action, method, and fields are required' }, { status: 400 });
    }

    const fields = payload.fields
      .filter((field) => field && typeof field.name === 'string' && typeof field.value === 'string')
      .map((field) => ({ name: field.name, value: field.value }));

    if (fields.length === 0) {
      return NextResponse.json({ error: 'At least one field is required' }, { status: 400 });
    }

    const results = await fetchMobileBgSearchResultsWithFallback(
      payload.action,
      payload.method,
      fields,
      typeof payload.sourceMobileId === 'string' ? payload.sourceMobileId : null,
    );
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch mobile.bg search results' },
      { status: 500 },
    );
  }
}
