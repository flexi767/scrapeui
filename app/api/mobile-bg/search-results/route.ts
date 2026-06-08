import { NextResponse } from 'next/server';
import {
  fetchMobileBgSearchResultsWithFallback,
  type MobileBgSearchFieldInput,
} from '@/lib/mobile-bg/search-results';
import { readJsonBody } from '@/lib/api/json-body';
import { getIgnoredSearchResultMobileIds } from '@/lib/mobile-bg/search-ignores';
import { errorMessage } from '@/lib/utils';
import { requireAuth } from '@/lib/api/auth-helpers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  try {
    const payload = await readJsonBody<{
      action?: string;
      method?: string;
      fields?: MobileBgSearchFieldInput[];
      sourceMobileId?: string | null;
      sourceListingId?: number | null;
    }>(request);

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
    const sourceListingId =
      typeof payload.sourceListingId === 'number' && Number.isFinite(payload.sourceListingId)
        ? payload.sourceListingId
        : null;

    return NextResponse.json({
      ...results,
      ignored_search_result_ids: sourceListingId != null ? getIgnoredSearchResultMobileIds(sourceListingId) : [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to fetch mobile.bg search results') },
      { status: 500 },
    );
  }
}
