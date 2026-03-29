import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { raw } from '@/db/client';

export interface CompetitorStatRow {
  make: string;
  model: string;
  count: number;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
}

// GET /api/listings/competitors/stats
// Returns competitor price stats grouped by make+model.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = raw.prepare(`
    SELECT
      make,
      model,
      COUNT(*) as count,
      MIN(price) as min_price,
      MAX(price) as max_price,
      CAST(AVG(price) AS INTEGER) as avg_price
    FROM competitor_listings
    WHERE price IS NOT NULL
      AND make IS NOT NULL
    GROUP BY make, model
  `).all() as CompetitorStatRow[];

  return NextResponse.json(rows);
}
