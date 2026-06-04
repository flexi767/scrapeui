-- Adds editable per-dealer public-site copy (about/finance/privacy/terms) as JSON.
-- Nullable; when empty the public inner pages fall back to templated placeholder text.
ALTER TABLE dealers ADD COLUMN public_content TEXT;
