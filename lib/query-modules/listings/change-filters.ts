import { toFtsPrefixQuery } from '../query-utils';

export interface TrackedChangesFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  fields?: string[];
  search?: string;
  whenStart?: string | null;
  whenEnd?: string | null;
  page?: number;
  limit?: number;
}

export const titleChangePredicate = `
  snapshot_title IS NOT NULL
  AND TRIM(snapshot_title) != ''
  AND snapshot_title != target_title
  AND target_title NOT LIKE '%' || snapshot_title
`;

export const actualTrackedChangePredicate = `
  (
    (snapshot_price IS NOT NULL AND snapshot_price != target_price) OR
    (snapshot_vat IS NOT NULL AND snapshot_vat != target_vat) OR
    (snapshot_last_edit IS NOT NULL AND snapshot_last_edit != target_last_edit) OR
    (snapshot_views IS NOT NULL AND snapshot_views != target_views) OR
    (snapshot_ad_status IS NOT NULL AND snapshot_ad_status != target_ad_status) OR
    (snapshot_kaparo IS NOT NULL AND snapshot_kaparo != target_kaparo) OR
    (${titleChangePredicate}) OR
    (snapshot_description IS NOT NULL AND TRIM(snapshot_description) != '' AND snapshot_description != target_description)
  )
`;

export function buildTrackedChangesWhere(filters: TrackedChangesFilters): {
  where: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.make) {
    clauses.push('l.make = ?');
    params.push(filters.make);
  }
  if (filters.model) {
    clauses.push('l.model = ?');
    params.push(filters.model);
  }
  if (filters.dealerSlugs && filters.dealerSlugs.length > 0) {
    clauses.push(
      `d.slug IN (${filters.dealerSlugs.map(() => '?').join(', ')})`,
    );
    params.push(...filters.dealerSlugs);
  }
  if (filters.search) {
    const ftsQuery = toFtsPrefixQuery(filters.search);
    const like = `%${filters.search}%`;
    if (ftsQuery) {
      clauses.push(`(
        EXISTS (
          SELECT 1
          FROM listing_change_search_fts
          WHERE listing_change_search_fts.rowid = l.id
            AND listing_change_search_fts MATCH ?
        )
        OR d.name LIKE ?
        OR l.mobile_id LIKE ?
        OR l.cars_id LIKE ?
      )`);
      params.push(ftsQuery, like, like, like);
    } else {
      clauses.push(`(d.name LIKE ? OR l.mobile_id LIKE ? OR l.cars_id LIKE ?)`);
      params.push(like, like, like);
    }
  }
  if (filters.whenStart && filters.whenEnd) {
    clauses.push('s.recorded_at >= ? AND s.recorded_at <= ?');
    params.push(filters.whenStart, filters.whenEnd);
  }
  if (filters.fields && filters.fields.length > 0) {
    const fieldMap: Record<string, string> = {
      price: 's.price IS NOT NULL',
      vat: 's.vat IS NOT NULL',
      last_edit: 's.last_edit IS NOT NULL',
      views: 's.views IS NOT NULL',
      ad_status: 's.ad_status IS NOT NULL',
      kaparo: 's.kaparo IS NOT NULL',
      title: `s.title IS NOT NULL AND TRIM(s.title) != ''`,
      description: `s.description IS NOT NULL AND TRIM(s.description) != ''`,
    };
    const selectedClauses = filters.fields
      .map((field) => fieldMap[field])
      .filter(Boolean);
    if (selectedClauses.length > 0) {
      clauses.push(`(${selectedClauses.join(' OR ')})`);
    }
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}
