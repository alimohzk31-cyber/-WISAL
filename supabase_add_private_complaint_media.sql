-- WISAL: private complaint image storage.
-- Non-destructive and intentionally separate from public service-media.
-- Apply this migration in Supabase before enabling complaint image uploads.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'complaint-media',
  'complaint-media',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS complaint_media_insert ON storage.objects;
DROP POLICY IF EXISTS complaint_media_select_admin ON storage.objects;
DROP POLICY IF EXISTS complaint_media_delete_admin ON storage.objects;

-- The complaint form may upload one object into the write-only incoming area.
-- There is no public SELECT policy, so an uploaded object is not readable by
-- ordinary users. The application enforces image type and one-file behavior.
CREATE POLICY complaint_media_insert
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'complaint-media'
    AND (storage.foldername(name))[1] = 'incoming'
  );

-- Only an authenticated administrator can create a signed URL for a complaint
-- image. The bucket remains private even when the URL is displayed in admin.
CREATE POLICY complaint_media_select_admin
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND public.is_admin()
  );

CREATE POLICY complaint_media_delete_admin
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'complaint-media'
    AND public.is_admin()
  );
