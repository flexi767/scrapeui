import { raw } from '@/db/client';
import { requireAuth } from '@/lib/api/auth-helpers';

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  lastScrapingAt: string | null;
  totalDealers: number;
}

export async function GET() {
  const check = await requireAuth();
  if ('error' in check) return check.error;

  const stats = raw.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) as active,
      COALESCE(MAX(last_seen_at), MAX(first_seen_at)) as lastScrapingAt,
      (SELECT COUNT(*) FROM dealers WHERE active = 1) as totalDealers
    FROM listings
  `).get() as {
    total: number;
    active: number;
    lastScrapingAt: string | null;
    totalDealers: number;
  };

  return Response.json({
    totalListings: stats.total,
    activeListings: stats.active,
    lastScrapingAt: stats.lastScrapingAt,
    totalDealers: stats.totalDealers,
  } satisfies DashboardStats);
}
