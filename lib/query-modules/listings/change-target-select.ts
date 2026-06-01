export const trackedChangeTargetSelect = `
  COALESCE((
    SELECT s2.price
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.price IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.current_price) as target_price,
  COALESCE((
    SELECT s2.vat
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.vat IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.vat) as target_vat,
  COALESCE((
    SELECT s2.last_edit
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.last_edit IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.last_edit) as target_last_edit,
  COALESCE((
    SELECT s2.views
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.views IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END) as target_views,
  COALESCE((
    SELECT s2.ad_status
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.ad_status IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.ad_status) as target_ad_status,
  COALESCE((
    SELECT s2.kaparo
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.kaparo IS NOT NULL
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.kaparo) as target_kaparo,
  COALESCE((
    SELECT s2.title
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.title IS NOT NULL
      AND TRIM(s2.title) != ''
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.title) as target_title,
  COALESCE((
    SELECT s2.description
    FROM listing_snapshots s2
    WHERE s2.listing_id = s.listing_id
      AND s2.description IS NOT NULL
      AND TRIM(s2.description) != ''
      AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
    ORDER BY s2.recorded_at ASC, s2.id ASC
    LIMIT 1
  ), l.description) as target_description
`;

