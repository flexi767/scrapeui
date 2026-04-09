UPDATE mobilebg_backups
SET created_at = (
  SELECT l.carsbg_created_date
  FROM listings AS l
  WHERE l.id = mobilebg_backups.listing_id
)
WHERE listing_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM listings AS l
    WHERE l.id = mobilebg_backups.listing_id
      AND l.carsbg_created_date IS NOT NULL
  )
  AND created_at IS NOT (
    SELECT l.carsbg_created_date
    FROM listings AS l
    WHERE l.id = mobilebg_backups.listing_id
  );
