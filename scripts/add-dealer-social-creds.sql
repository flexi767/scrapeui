-- Add social credential columns to dealers table
ALTER TABLE dealers ADD COLUMN facebook_user TEXT;
ALTER TABLE dealers ADD COLUMN facebook_password TEXT;
ALTER TABLE dealers ADD COLUMN instagram_user TEXT;
ALTER TABLE dealers ADD COLUMN instagram_password TEXT;
ALTER TABLE dealers ADD COLUMN tiktok_user TEXT;
ALTER TABLE dealers ADD COLUMN tiktok_password TEXT;
