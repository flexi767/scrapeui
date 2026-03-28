-- Add mobile.bg make/model ids to listings
ALTER TABLE listings ADD COLUMN mobile_make_id INTEGER;
ALTER TABLE listings ADD COLUMN mobile_model_id INTEGER;
