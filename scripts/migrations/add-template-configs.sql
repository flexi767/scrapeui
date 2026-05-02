-- Add dealer_id FK to users (nullable; null = admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL;

-- Template configs table
CREATE TABLE IF NOT EXISTS dealer_template_configs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id        INTEGER REFERENCES dealers(id) ON DELETE CASCADE,
  base_template_id INTEGER REFERENCES dealer_template_configs(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  config_json      TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

-- Active config pointer on dealers
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS active_template_config_id INTEGER
  REFERENCES dealer_template_configs(id) ON DELETE SET NULL;
