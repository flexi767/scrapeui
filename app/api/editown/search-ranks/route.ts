import { NextResponse } from 'next/server';
import { runOwnSearchRankChecks } from '@/lib/mobile-bg/own-search-ranks';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null) as { missingOnly?: boolean } | null;
    const results = await runOwnSearchRankChecks({
      missingOnly: payload?.missingOnly === true,
    });
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run own listing search checks' },
      { status: 500 },
    );
  }
}
