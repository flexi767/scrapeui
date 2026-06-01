CREATE TABLE IF NOT EXISTS instagram_poster_defaults (
  scope_key TEXT PRIMARY KEY,
  prompt_template TEXT NOT NULL,
  variant_prompts_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
