-- Add cars.bg make/model ids to listings
ALTER TABLE listings ADD COLUMN cars_make_id INTEGER;
ALTER TABLE listings ADD COLUMN cars_model_id INTEGER;
