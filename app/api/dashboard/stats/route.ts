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

  // Get last scraping time (most recent backup run that finished)
  const lastScrape = raw.prepare(`
    SELECT finished_at
    FROM mobilebg_backup_runs
    WHERE status = 'completed' AND finished_at IS NOT NULL
    ORDER BY finished_at DESC
    LIMIT 1
  `).get() as { finished_at: string } | undefined;

  if (lastScrape) {
    stats.lastScrapingAt = lastScrape.finished_at;
  }

  // Get total dealers
  const dealersCount = raw.prepare(`
    SELECT COUNT(*) as total FROM dealers WHERE active = 1
  `).get() as { total: number };

  stats.totalDealers = dealersCount.total;

  return Response.json(stats);
}
