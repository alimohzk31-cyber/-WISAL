-- WISAL SECURITY — PHASE 2C-2
-- PROPOSAL ONLY. DO NOT EXECUTE ON SUPABASE REMOTE.
--
-- service-media remains PUBLIC for reads. This proposal replaces only the
-- open INSERT policy named "Allow Uploads" and adds path-bound write/delete
-- policies. It does not make the bucket private and does not touch public
-- SELECT policies.
--
-- Proposed supported paths:
--   services/<auth.uid()>/<generated-file>
--   jobs/<auth.uid()>/images/<generated-file>
--   slider/<generated-file>         (administrator only)
-- The profile path and job-video path are intentionally not enabled here.
--
-- File MIME and size are checked locally. Storage bucket file_size_limit and
-- allowed_mime_types must be reviewed before applying this proposal; no limit
-- is guessed or changed here.

-- Remove the known open policy. Do not leave it alongside the new policies:
-- PostgreSQL permissive policies are combined with OR semantics.
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;

-- --------------------------------------------------------------------------
-- Service images: services/<auth.uid()>/<generated-file>
-- storage.foldername(name)[1] = services; [2] = authenticated user id.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wisal_service_media_services_insert ON storage.objects;
CREATE POLICY wisal_service_media_services_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'services'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  AND coalesce(metadata->>'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
);

DROP POLICY IF EXISTS wisal_service_media_services_delete ON storage.objects;
CREATE POLICY wisal_service_media_services_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'services'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- --------------------------------------------------------------------------
-- Job images: jobs/<auth.uid()>/images/<generated-file>
-- storage.foldername(name)[1] = jobs; [2] = authenticated user id;
-- [3] = images. Video storage is intentionally not supported.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wisal_service_media_jobs_insert ON storage.objects;
CREATE POLICY wisal_service_media_jobs_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'jobs'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND (storage.foldername(name))[3] = 'images'
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  AND coalesce(metadata->>'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
);

DROP POLICY IF EXISTS wisal_service_media_jobs_delete ON storage.objects;
CREATE POLICY wisal_service_media_jobs_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'jobs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- --------------------------------------------------------------------------
-- Slider: service-media/slider/<generated-file>, administrators only
-- storage.foldername(name)[1] = slider.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS wisal_service_media_slider_insert ON storage.objects;
CREATE POLICY wisal_service_media_slider_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'slider'
  AND public.is_admin()
  AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif')
  AND coalesce(metadata->>'mimetype', '') IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')
);

-- Remove the legacy policy by its known deployed name before adding the
-- replacement, so two slider delete policies cannot remain in parallel.
DROP POLICY IF EXISTS slider_media_delete_admin ON storage.objects;
DROP POLICY IF EXISTS wisal_service_media_slider_delete ON storage.objects;
CREATE POLICY wisal_service_media_slider_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'service-media'
  AND (storage.foldername(name))[1] = 'slider'
  AND public.is_admin()
);

-- No UPDATE policy is proposed. The frontend uses upsert=false and generated
-- names, so overwriting another object is not part of the supported flow.
