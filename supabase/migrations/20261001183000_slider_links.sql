-- WISAL: optional slider links only. Existing columns, rows and policies stay intact.
BEGIN;
ALTER TABLE public.slider_images
  ADD COLUMN IF NOT EXISTS button_text text NULL,
  ADD COLUMN IF NOT EXISTS button_link text NULL,
  ADD COLUMN IF NOT EXISTS facebook_url text NULL,
  ADD COLUMN IF NOT EXISTS instagram_url text NULL,
  ADD COLUMN IF NOT EXISTS tiktok_url text NULL,
  ADD COLUMN IF NOT EXISTS twitter_url text NULL;
COMMIT;
