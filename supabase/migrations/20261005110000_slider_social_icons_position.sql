-- Add only the approved slider icon-position setting. No row updates or other schema changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.slider_images
  ADD COLUMN IF NOT EXISTS social_icons_position text NOT NULL DEFAULT 'left';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.slider_images'::regclass
      AND conname = 'slider_images_social_icons_position_check') THEN
    ALTER TABLE public.slider_images
      ADD CONSTRAINT slider_images_social_icons_position_check
      CHECK (social_icons_position IN ('left', 'right', 'top', 'bottom'));
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
