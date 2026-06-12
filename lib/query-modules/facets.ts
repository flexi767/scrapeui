import { raw } from '@/db/client';
import { timedQuery } from './query-utils';

let dealerFacetTableExists: boolean | null = null;

function hasDealerListingFacetsTable() {
  dealerFacetTableExists ??= Boolean(
    raw
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'dealer_listing_facets'")
      .get(),
  );
  return dealerFacetTableExists;
}

export function getDealerMakeFacets(
  dealerId: number,
  fallback: () => string[],
): string[] {
  if (!hasDealerListingFacetsTable()) return fallback();

  const rows = timedQuery('facets.dealer-makes', { dealerId }, () => raw
    .prepare(
      `SELECT facet_value
       FROM dealer_listing_facets
       WHERE dealer_id = ? AND facet_type = 'make' AND listing_count > 0
       ORDER BY facet_value`,
    )
    .all(dealerId) as { facet_value: string }[]);

  return rows.length > 0 ? rows.map((row) => row.facet_value) : fallback();
}
