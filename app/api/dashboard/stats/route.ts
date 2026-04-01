import { raw } from '@/db/client';

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  lastScrapingAt: string | null;
  totalDealers: number;
}

export function GET() {
  const stats: DashboardStats = {
    totalListings: 0,
    activeListings: 0,
    lastScrapingAt: null,
    totalDealers: 0,
  };

  // Get total and active listings
  const listingsCount = raw.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active
    FROM listings
  `).get() as { total: number; active: number };

  stats.totalListings = listingsCount.total;
  stats.activeListings = listingsCount.active;

  // Get last scraping time from listing sync activity.
  const lastScrape = raw.prepare(`
    SELECT MAX(last_seen_at) as last_seen_at
    FROM listings
    WHERE last_seen_at IS NOT NULL
  `).get() as { last_seen_at: string | null } | undefined;

  if (lastScrape?.last_seen_at) {
    stats.lastScrapingAt = lastScrape.last_seen_at;
  } else {
    const fallbackScrape = raw.prepare(`
      SELECT MAX(first_seen_at) as first_seen_at
      FROM listings
      WHERE first_seen_at IS NOT NULL
    LIMIT 1
    `).get() as { first_seen_at: string | null } | undefined;

    if (fallbackScrape?.first_seen_at) {
      stats.lastScrapingAt = fallbackScrape.first_seen_at;
    }
  }

  // Get total dealers
  const dealersCount = raw.prepare(`
    SELECT COUNT(*) as total FROM dealers WHERE active = 1
  `).get() as { total: number };

  stats.totalDealers = dealersCount.total;

  return Response.json(stats);
}
