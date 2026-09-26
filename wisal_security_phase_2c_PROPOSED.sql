-- WISAL SECURITY — PHASE 2C PROPOSED HARDENING
-- PROPOSAL ONLY. DO NOT RUN AUTOMATICALLY.
-- No statement in this file has been executed against Supabase Remote.
-- Review the Phase 2B output, exact policy names, column types, and a backup
-- plan before applying any section manually.

-- ============================================================================
-- 1) get_own_pending_service_id — recommended compatible fix
-- ============================================================================
-- Local frontend inspection shows:
--   * addService() calls ensureUserSession() first.
--   * ensureUserSession() creates/reuses a Supabase anonymous Auth session.
--   * buildInsertPayload() prefers session.user.id for services.owner_id.
--   * the current localStorage device ID is only a fallback/legacy identity.
-- Therefore this RPC can be bound to auth.uid() without breaking the current
-- new-service path. Existing rows written with legacy owner_* values will not
-- be returned by this hardened RPC until they are deliberately reconciled.
-- The argument remains for API compatibility but is intentionally not trusted.

CREATE OR REPLACE FUNCTION public.get_own_pending_service_id(
  p_slug text,
  p_owner_id text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.services AS s
  WHERE s.slug = p_slug
    AND s.status = 'pending'
    AND auth.uid() IS NOT NULL
    AND s.owner_id = auth.uid()::text
  LIMIT 1;
$$;

-- The application calls this after ensureUserSession(), so anonymous Auth
-- users use the authenticated database role. Direct anon execution is not
-- needed for the hardened path and must be removed.
REVOKE EXECUTE ON FUNCTION public.get_own_pending_service_id(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_own_pending_service_id(text, text) TO authenticated;

-- ============================================================================
-- 2) service-media — proposal requiring a small identity/path alignment
-- ============================================================================
-- Current local upload paths are:
--   contact/profiles/<auth-user-id>/<kind>
--   jobs/images/<generated-name> and jobs/videos/<generated-name>
--   slider/<generated-name>
-- Profiles already carry an Auth identity. Jobs and slider currently generate
-- paths without an owner/admin identifier. A bucket policy alone cannot prove
-- which authenticated user owns those generated paths.
--
-- Required application alignment before activating a strict policy:
--   a) keep ensureUserSession() before job media upload;
--   b) change job paths to jobs/<auth.uid()>/images/... and jobs/<auth.uid()>/videos/...;
--   c) keep slider uploads behind the authenticated admin flow and use slider/<admin-uid>/...;
--   d) keep profile paths bound to auth.uid();
--   e) enforce the bucket's size/MIME configuration after confirming the
--      intended limits for every current service-media consumer.
--
-- The exact current INSERT policy name was not included in the Phase 2B facts.
-- Do not add a second permissive policy. First substitute the exact audited
-- policy name in the DROP line below; otherwise the old public policy could
-- remain effective through PostgreSQL's permissive-policy OR behavior.
--
-- TEMPLATE — KEEP COMMENTED UNTIL THE PATH CHANGE AND EXACT POLICY NAME ARE VERIFIED:
-- DROP POLICY IF EXISTS "<EXACT_AUDITED_SERVICE_MEDIA_INSERT_POLICY>" ON storage.objects;
-- CREATE POLICY "wisal_service_media_insert_authenticated"
-- ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (
--   bucket_id = 'service-media'
--   AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm')
--   AND (
--     (
--       (storage.foldername(name))[1] = 'contact'
--       AND (storage.foldername(name))[2] = 'profiles'
--       AND (storage.foldername(name))[3] = auth.uid()::text
--     )
--     OR (
--       (storage.foldername(name))[1] = 'jobs'
--       AND (storage.foldername(name))[2] = auth.uid()::text
--       AND (storage.foldername(name))[3] IN ('images', 'videos')
--     )
--     OR (
--       (storage.foldername(name))[1] = 'slider'
--       AND (storage.foldername(name))[2] = auth.uid()::text
--       AND public.is_admin()
--     )
--   )
-- );
--
-- A separate exact-name policy for UPDATE, if needed by the application, must
-- use the same owner path and auth.uid() check. Keep overwrite disabled in the
-- uploader (upsert=false), and do not enable public write access again.

-- ============================================================================
-- 3) comments / reactions — current identity limitation
-- ============================================================================
-- Current frontend writes owner_id from localStorage (saleen_owner_id) for:
--   public.comments, public.service_comments, public.service_reactions,
--   and the suggestion interaction tables.
-- That value is useful for same-device UX only; it is not cryptographic proof
-- of authorship and cannot safely be compared with auth.uid() today.
--
-- No active RLS rewrite is proposed in this file for these tables because an
-- auth.uid()-based policy would break the current public interaction flow.
-- The safe current statement is that owner_id impersonation remains possible.
-- Future hardening requires calling ensureUserSession() before every write,
-- persisting auth.uid() as the owner value, and then replacing each INSERT,
-- change, and remove policy with an auth.uid()-based condition. Those policy
-- names must come from the remote audit and are intentionally not guessed here.

-- ============================================================================
-- 4) slider storage — verified local source of the current upload path
-- ============================================================================
-- The current frontend uploads slider media to service-media/slider and stores
-- the resulting public URL in public.slider_images. The slider-images bucket
-- is not referenced by the current source. Treat any slider-images policy as
-- legacy until remote object usage and references are independently verified.
-- Do not remove the legacy policy in this proposal.
--
-- Once the service-media path/auth alignment in section 2 is complete, slider
-- writes should be limited to authenticated administrators using public.is_admin().
-- The exact policy replacement must use the audited remote policy name.

-- ============================================================================
-- 5) admin protection — intentionally unchanged
-- ============================================================================
-- No changes are proposed here to public.is_admin(), admin service RPCs,
-- contact_messages, or complaint-media. Their current protections must be
-- rechecked from the Phase 2B output before any later migration is prepared.
