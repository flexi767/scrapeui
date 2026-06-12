import { raw } from '@/db/client';
import { currentIsoTimestamp } from '@/lib/date-format';

const now = currentIsoTimestamp();

raw.exec(`
  CREATE TABLE IF NOT EXISTS dealer_listing_facets (
    dealer_id integer NOT NULL,
    facet_type text NOT NULL,
    facet_value text NOT NULL,
    listing_count integer NOT NULL DEFAULT 0,
    updated_at text,
    PRIMARY KEY (dealer_id, facet_type, facet_value)
  );
`);

const rebuild = raw.transaction(() => {
  raw.prepare('DELETE FROM dealer_listing_facets').run();

  for (const facetType of ['make', 'fuel', 'reg_year', 'body_type', 'ad_status']) {
    raw.prepare(`
      INSERT INTO dealer_listing_facets (dealer_id, facet_type, facet_value, listing_count, updated_at)
      SELECT dealer_id, ?, ${facetType === 'reg_year' ? 'reg_year' : facetType}, COUNT(*), ?
      FROM listings
      WHERE is_active = 1
        AND (duplicate = 0 OR duplicate IS NULL)
        AND ${facetType === 'reg_year' ? 'reg_year' : facetType} IS NOT NULL
        AND ${facetType === 'reg_year' ? 'reg_year' : facetType} != ''
      GROUP BY dealer_id, ${facetType === 'reg_year' ? 'reg_year' : facetType}
    `).run(facetType, now);
  }
});

rebuild();

const row = raw
  .prepare('SELECT COUNT(*) as count FROM dealer_listing_facets')
  .get() as { count: number };

console.log(`Rebuilt ${row.count} dealer listing facets.`);
