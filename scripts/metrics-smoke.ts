import { getPublicDealer, getPublicListings } from '@/lib/queries';
import { metricsSnapshot } from '@/lib/observability/metrics';
import { raw } from '@/db/client';

const dealer = raw
  .prepare('SELECT id, slug FROM dealers WHERE active = 1 ORDER BY id LIMIT 1')
  .get() as { id: number; slug: string } | undefined;

if (dealer) {
  getPublicDealer(dealer.slug);
  getPublicListings(dealer.id, { limit: 12, sort: 'newest' });
}

console.log(JSON.stringify(metricsSnapshot(), null, 2));
