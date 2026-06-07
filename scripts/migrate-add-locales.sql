-- Create locales table
CREATE TABLE IF NOT EXISTS locales (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

-- Create translation_keys table
CREATE TABLE IF NOT EXISTS translation_keys (
  id TEXT PRIMARY KEY,
  context TEXT,
  description TEXT,
  plural_rules INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create translations table
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  translation_key_id TEXT NOT NULL,
  locale_code TEXT NOT NULL,
  value TEXT NOT NULL,
  plural_form TEXT,
  interpolation_vars TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(translation_key_id, locale_code, plural_form),
  FOREIGN KEY (translation_key_id) REFERENCES translation_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (locale_code) REFERENCES locales(code) ON DELETE CASCADE
);

-- Seed supported locales
INSERT OR IGNORE INTO locales (code, name, is_active) VALUES
  ('bg', 'Български', 1),
  ('en', 'English', 1),
  ('de', 'Deutsch', 1),
  ('ru', 'Русский', 1);
