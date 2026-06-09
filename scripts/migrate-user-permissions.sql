-- scripts/migrate-user-permissions.sql
-- NOTE: The ALTER TABLE statement below is NOT idempotent.
-- Apply this migration exactly once. Re-running it will fail with "duplicate column name: email".

-- Add email to users (nullable; existing accounts won't have one)
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users(email) WHERE email IS NOT NULL;

-- Per-user page visibility grants
CREATE TABLE IF NOT EXISTS user_page_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  page_key TEXT NOT NULL,
  created_at TEXT,
  UNIQUE(user_id, page_key)
);

-- Backfill: existing non-admin users keep seeing everything they see today.
-- (dashboard is always-visible and intentionally NOT inserted here.)
INSERT OR IGNORE INTO user_page_permissions (user_id, page_key, created_at)
SELECT u.id, k.page_key, CURRENT_TIMESTAMP
FROM users u
CROSS JOIN (
  SELECT 'listings' AS page_key UNION ALL
  SELECT 'editown' UNION ALL
  SELECT 'mobilebg' UNION ALL
  SELECT 'tasks' UNION ALL
  SELECT 'expenses' UNION ALL
  SELECT 'templates' UNION ALL
  SELECT 'translations' UNION ALL
  SELECT 'config' UNION ALL
  SELECT 'mapping' UNION ALL
  SELECT 'kb' UNION ALL
  SELECT 'files' UNION ALL
  SELECT 'dealers'
) k
WHERE u.role != 'admin';
