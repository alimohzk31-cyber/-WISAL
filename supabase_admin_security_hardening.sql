-- ============================================================================
-- WISAL — Admin authorization hardening — FINAL REVIEW COPY (NOT executed yet)
-- ============================================================================
-- REVISION NOTES (second dry review)
--   1. jobs: the admin DELETE path is now complete and explicit — RLS enabled,
--      anon privileges reduced to SELECT/INSERT, DELETE/UPDATE/SELECT granted
--      to authenticated, and the missing permissive DELETE policy
--      (wisal_admin_jobs_delete) created/refreshed. The restrictive gate
--      wisal_gate_jobs_delete stays as an independent second check.
--   2. contact_messages: the three admin RPCs called by the application
--      (admin_list_contact_messages, admin_set_contact_message_status,
--      admin_delete_contact_message) are DEFINED here — they never existed in
--      any migration, which made the previous revision abort before applying
--      anything. Safe grants (INSERT for public submission, SELECT/UPDATE/
--      DELETE for authenticated + sequence USAGE) are added so those RPCs
--      cannot fail with "permission denied for table contact_messages".
--   3. admin_* functions are inspected one by one (overloads, in-body guard,
--      dependency table) instead of being converted blindly or aborting the
--      transaction. EXECUTE is revoked from PUBLIC/anon for all of them, and
--      returned to `authenticated` only when the body itself asserts
--      public.is_admin() / public.require_admin(); otherwise it stays revoked
--      and is reported through a NOTICE.
--   4. Storage: service-media and slider-images bind every 'slider' path to
--      admins, while service-media/contact, service-media/jobs/images,
--      service-media/jobs/videos and every unrelated bucket (services-images,
--      job-applications, ...) keep their existing behaviour. Path checks are
--      NULL-safe so root-level legacy objects are not blocked by NULL logic.
--   5. public.require_admin() is never used inside a USING / WITH CHECK
--      condition any more. A condition that RAISES 42501 would also surface as
--      a hard error on unrelated statements (storage uploads, INSERT ...
--      RETURNING, signed URLs, ...). All policy conditions use the pure boolean
--      public.is_admin(). require_admin() stays defined (and executable by
--      anon/authenticated) as an explicit-denial helper for future admin RPCs.
--   6. Public submission is preserved: services and jobs can only be inserted
--      with status = 'pending', contact_messages only with status = 'new'.
--
-- Guarantees:
--   * NO table/row/column/data is dropped, inserted, updated, or deleted.
--   * NO existing policy is dropped; incompatible name collisions abort.
--   * authenticated does NOT imply admin. public.is_admin() is authoritative.
--   * Works whether or not supabase_jobs_media_upgrade.sql /
--     supabase_job_slides_upgrade.sql / supabase_job_applications.sql ran.
--
-- Run only after reviewing this file in the Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Identity helpers
-- ---------------------------------------------------------------------------
-- The role check reads only the caller identity from the verified JWT.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- anon MUST keep EXECUTE: the restrictive Storage gates below evaluate this
-- function for anonymous uploads. It only reads auth.uid() and returns false.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Explicit-denial helper. NEVER call it from a policy condition (see note 5):
-- use it inside admin RPC bodies that want a real 42501 error instead of an
-- empty result set.
CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.require_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.require_admin() TO anon, authenticated;

-- Neutralize the legacy spoofable x-admin-mode helper without dropping it.
-- Any older policy still referring to request_is_admin() now uses the real role.
CREATE OR REPLACE FUNCTION public.request_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.request_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_is_admin() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) Reviewed admin RPCs — public.services (exactly these four names)
-- ---------------------------------------------------------------------------
-- Recreated with an explicit role assertion. SECURITY INVOKER also keeps table
-- privileges and RLS effective, so a non-admin authenticated user gets both an
-- error here and no rows from RLS.
CREATE OR REPLACE FUNCTION public.admin_list_services(p_status text DEFAULT NULL)
RETURNS SETOF public.services
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.services
    WHERE p_status IS NULL OR status = p_status
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_service_status(
  p_id integer,
  p_status text,
  p_rejection_reason text DEFAULT NULL
)
RETURNS public.services
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated public.services%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid service status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.services
     SET status = p_status,
         rejection_reason = p_rejection_reason,
         reviewed_at = now(),
         updated_at = now()
   WHERE id = p_id
   RETURNING * INTO updated;
  RETURN updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_service(
  p_id integer,
  p_payload jsonb
)
RETURNS public.services
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated public.services%ROWTYPE;
  k text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'payload must not be empty' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_payload) LOOP
    IF k NOT IN ('title','description','phone','image_url','status','slug',
                 'profession','address','latitude','longitude',
                 'category_id','category_slug','rejection_reason') THEN
      RAISE EXCEPTION 'unsupported service field: %', k USING ERRCODE = '22023';
    END IF;
  END LOOP;

  UPDATE public.services SET
    title            = CASE WHEN p_payload ? 'title'            THEN p_payload->>'title'            ELSE title            END,
    description      = CASE WHEN p_payload ? 'description'      THEN p_payload->>'description'      ELSE description      END,
    phone            = CASE WHEN p_payload ? 'phone'            THEN p_payload->>'phone'            ELSE phone            END,
    image_url        = CASE WHEN p_payload ? 'image_url'        THEN p_payload->>'image_url'        ELSE image_url        END,
    status           = CASE WHEN p_payload ? 'status'           THEN p_payload->>'status'           ELSE status           END,
    slug             = CASE WHEN p_payload ? 'slug'             THEN p_payload->>'slug'             ELSE slug             END,
    profession       = CASE WHEN p_payload ? 'profession'       THEN p_payload->>'profession'       ELSE profession       END,
    address          = CASE WHEN p_payload ? 'address'          THEN p_payload->>'address'          ELSE address          END,
    latitude         = CASE WHEN p_payload ? 'latitude'         THEN (p_payload->>'latitude')::double precision ELSE latitude  END,
    longitude        = CASE WHEN p_payload ? 'longitude'        THEN (p_payload->>'longitude')::double precision ELSE longitude END,
    category_id      = CASE WHEN p_payload ? 'category_id'      THEN p_payload->>'category_id'      ELSE category_id      END,
    category_slug    = CASE WHEN p_payload ? 'category_slug'    THEN p_payload->>'category_slug'    ELSE category_slug    END,
    rejection_reason = CASE WHEN p_payload ? 'rejection_reason' THEN p_payload->>'rejection_reason' ELSE rejection_reason END,
    updated_at       = now()
   WHERE id = p_id
   RETURNING * INTO updated;
  RETURN updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_service(p_id integer)
RETURNS public.services
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  deleted public.services%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.services WHERE id = p_id RETURNING * INTO deleted;
  RETURN deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Reviewed admin RPCs — public.contact_messages (exactly these three names)
-- ---------------------------------------------------------------------------
-- src/hooks/useContactMessages.ts calls these three RPCs, but no migration in
-- this repository defines them (the admin messages tab uses public.comments
-- instead). The previous revision merely asserted that they exist, so the whole
-- transaction aborted. Defining them here keeps the inbox API working with the
-- same hardening pattern as the service RPCs.
CREATE OR REPLACE FUNCTION public.admin_list_contact_messages()
RETURNS SETOF public.contact_messages
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT *
    FROM public.contact_messages
    ORDER BY created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_contact_message_status(
  p_id bigint,
  p_status text
)
RETURNS public.contact_messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  updated public.contact_messages%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('new', 'review', 'resolved') THEN
    RAISE EXCEPTION 'invalid contact message status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.contact_messages
     SET status = p_status,
         updated_at = now()
   WHERE id = p_id
   RETURNING * INTO updated;
  RETURN updated;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_contact_message(p_id bigint)
RETURNS public.contact_messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  deleted public.contact_messages%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin authorization required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.contact_messages WHERE id = p_id RETURNING * INTO deleted;
  RETURN deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Table grants required by the SECURITY INVOKER RPCs
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER uses the caller's table grants. Make the exact grants needed
-- by the reviewed service RPCs explicit; RLS still decides which rows are usable.
GRANT SELECT, UPDATE, DELETE ON TABLE public.services TO authenticated;

-- Public submission stays available, but RLS below still requires pending.
GRANT SELECT, INSERT ON TABLE public.services TO anon;
GRANT SELECT, INSERT ON TABLE public.services TO authenticated;

-- contact_messages: reset to the minimum required privileges.
--   * anon / authenticated : INSERT only (public suggestion form; RLS forces
--     status = 'new', so an administrative state cannot be chosen).
--   * authenticated        : SELECT / UPDATE / DELETE for the reviewed admin
--     RPCs — RLS still requires public.is_admin() on every one of them.
--   * sequence             : USAGE/SELECT is what the identity INSERT needs.
DO $security$
DECLARE
  contact_sequence text;
BEGIN
  IF to_regclass('public.contact_messages') IS NULL THEN
    RAISE EXCEPTION 'public.contact_messages is required by the reviewed admin contact RPCs';
  END IF;

  REVOKE ALL ON TABLE public.contact_messages FROM anon, authenticated;
  GRANT INSERT ON TABLE public.contact_messages TO anon, authenticated;
  GRANT SELECT, UPDATE, DELETE ON TABLE public.contact_messages TO authenticated;

  contact_sequence := pg_get_serial_sequence('public.contact_messages', 'id');
  IF contact_sequence IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon, authenticated', contact_sequence);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', contact_sequence);
  END IF;
END
$security$;

-- ---------------------------------------------------------------------------
-- 4b) Least privilege for the anonymous role
-- ---------------------------------------------------------------------------
-- anon never performs an administrative write in this application (it only
-- inserts pending services/jobs, submits contact messages/suggestions and job
-- applications). Supabase default privileges can still hand anon UPDATE/DELETE
-- on a new table, so remove them explicitly. The RESTRICTIVE gates below deny
-- these operations anyway; this makes the privilege layer agree with the policy
-- layer instead of relying on it alone.
-- NOT touched: public.comments / suggestion_* (public feeds write as anon),
-- service_* interaction tables, and every INSERT/SELECT path listed below.
DO $security$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'public.services',
    'public.categories',
    'public.slider_images',
    'public.job_categories',
    'public.job_slides',
    'public.job_slider_settings',
    'public.admin_notifications',
    'public.job_applications'
  ] LOOP
    IF to_regclass(target) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE UPDATE, DELETE ON TABLE %s FROM anon', target);
  END LOOP;
END
$security$;

-- ---------------------------------------------------------------------------
-- 5) admin_* privilege audit — inspect every function, then lock it down
-- ---------------------------------------------------------------------------
-- Nothing is converted blindly and nothing aborts the transaction:
--   * every overload of every public admin_* function is switched to
--     SECURITY INVOKER (no privilege escalation through a definer body),
--   * EXECUTE is revoked from PUBLIC and anon (fail-closed),
--   * EXECUTE is granted back to `authenticated` only when the function body
--     itself asserts public.is_admin() / public.require_admin(); otherwise it
--     stays revoked for `authenticated` too and is reported through a NOTICE,
--   * the reviewed names are inspected against their dependency table
--     (public.services / public.contact_messages) and must still exist.
DO $security$
DECLARE
  reviewed_names constant text[] := ARRAY[
    'admin_list_services',
    'admin_set_service_status',
    'admin_update_service',
    'admin_delete_service',
    'admin_list_contact_messages',
    'admin_set_contact_message_status',
    'admin_delete_contact_message'
  ];
  reviewed_name text;
  reviewed_overloads integer;
  function_row record;
  locked_out text[] := ARRAY[]::text[];
  dependency_mismatch text[] := ARRAY[]::text[];
  unreviewed_names text[] := ARRAY[]::text[];
BEGIN
  FOR function_row IN
    SELECT p.oid::regprocedure AS signature,
           p.proname AS name,
           lower(p.prosrc) AS body,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND left(p.proname, 6) = 'admin_'
    ORDER BY p.proname, args
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', function_row.signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', function_row.signature);

    IF position('is_admin' IN function_row.body) > 0
       OR position('require_admin' IN function_row.body) > 0 THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_row.signature);
    ELSE
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', function_row.signature);
      locked_out := locked_out || function_row.signature::text;
    END IF;

    IF NOT (function_row.name = ANY (reviewed_names)) THEN
      unreviewed_names := unreviewed_names || function_row.name;
    ELSIF function_row.name LIKE '%contact_message%' THEN
      IF position('contact_messages' IN function_row.body) = 0 THEN
        dependency_mismatch := dependency_mismatch || function_row.signature::text;
      END IF;
    ELSE
      IF position('public.services' IN function_row.body) = 0 THEN
        dependency_mismatch := dependency_mismatch || function_row.signature::text;
      END IF;
    END IF;
  END LOOP;

  -- Every reviewed name must still exist (defensive: our CREATE OR REPLACE above).
  FOREACH reviewed_name IN ARRAY reviewed_names LOOP
    SELECT count(*) INTO reviewed_overloads
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = reviewed_name;

    IF reviewed_overloads = 0 THEN
      RAISE EXCEPTION 'Reviewed admin RPC % is missing after being defined', reviewed_name;
    END IF;
  END LOOP;

  IF cardinality(unreviewed_names) > 0 THEN
    RAISE NOTICE 'admin_* functions outside the reviewed list (inspected, never rewritten): %',
      array_to_string(unreviewed_names, ', ');
  END IF;
  IF cardinality(locked_out) > 0 THEN
    RAISE NOTICE 'admin_* functions without an in-body admin assertion (EXECUTE revoked, including authenticated): %',
      array_to_string(locked_out, ', ');
  END IF;
  IF cardinality(dependency_mismatch) > 0 THEN
    RAISE NOTICE 'Reviewed admin RPC overloads no longer referencing their dependency table: %',
      array_to_string(dependency_mismatch, ', ');
  END IF;
END
$security$;

-- ---------------------------------------------------------------------------
-- 6) public.jobs — the reported admin-delete blocker, resolved end to end
-- ---------------------------------------------------------------------------
-- The jobs migration granted DELETE to `authenticated` but never created a
-- permissive DELETE policy, so RLS denied every admin delete. Full chain now:
--   1. privileges       : SELECT/INSERT/UPDATE/DELETE for authenticated,
--                         SELECT/INSERT only for anon (explicit REVOKE first,
--                         because Supabase default privileges can grant anon
--                         more than the migration did),
--   2. permissive policy: wisal_admin_jobs_delete USING (public.is_admin()),
--   3. restrictive gate : wisal_gate_jobs_delete  USING (public.is_admin()),
--   4. child rows       : job_applications.job_id REFERENCES jobs(id)
--                         ON DELETE CASCADE — the FK cannot block the delete,
--   5. storage objects  : jobs/images and jobs/videos are not restricted by
--                         any Storage gate, so the admin can clean them up.
DO $security$
DECLARE
  existing record;
  jobs_sequence text;
BEGIN
  IF to_regclass('public.jobs') IS NOT NULL THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

    REVOKE ALL ON TABLE public.jobs FROM anon;
    GRANT SELECT, INSERT ON TABLE public.jobs TO anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.jobs TO authenticated;

    jobs_sequence := pg_get_serial_sequence('public.jobs', 'id');
    IF jobs_sequence IS NOT NULL THEN
      EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon, authenticated', jobs_sequence);
    END IF;

    SELECT permissive, cmd
      INTO existing
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'wisal_admin_jobs_delete';

    IF FOUND AND (existing.permissive <> 'PERMISSIVE' OR existing.cmd <> 'DELETE') THEN
      RAISE EXCEPTION 'Policy public.jobs.wisal_admin_jobs_delete has an incompatible type';
    END IF;

    IF FOUND THEN
      ALTER POLICY wisal_admin_jobs_delete ON public.jobs
        TO authenticated USING (public.is_admin());
    ELSE
      CREATE POLICY wisal_admin_jobs_delete
        ON public.jobs AS PERMISSIVE FOR DELETE TO authenticated
        USING (public.is_admin());
    END IF;
  END IF;
END
$security$;

-- ---------------------------------------------------------------------------
-- 7) contact_messages — public submission contract (permissive INSERT)
-- ---------------------------------------------------------------------------
-- The restrictive gate in section 8 only narrows (AND) whatever permissive
-- policies already exist. Two migrations define the same policy name with
-- different checks: 'auth.uid() IS NOT NULL' (supabase_security_phase1.sql) and
-- status = 'new' (supabase_add_contact_messages.sql). Whichever ran last wins,
-- and the legacy variant silently blocks the anonymous suggestion form
-- (src/hooks/useContactMessages.ts → sendContactMessage). This block pins the
-- documented contract (anon + authenticated may submit as status = 'new')
-- without dropping anything and without touching any row.
DO $security$
DECLARE
  existing record;
BEGIN
  IF to_regclass('public.contact_messages') IS NULL THEN
    RAISE EXCEPTION 'public.contact_messages is required by the reviewed admin contact RPCs';
  END IF;

  ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

  SELECT permissive, cmd
    INTO existing
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'contact_messages'
    AND policyname = 'contact_messages_insert_policy';

  IF FOUND AND (existing.permissive <> 'PERMISSIVE' OR existing.cmd <> 'INSERT') THEN
    RAISE EXCEPTION 'Policy public.contact_messages.contact_messages_insert_policy has an incompatible type';
  END IF;

  IF FOUND THEN
    ALTER POLICY contact_messages_insert_policy ON public.contact_messages
      TO anon, authenticated
      WITH CHECK (
        status = 'new'
        AND length(trim(message)) > 0
        AND length(message) <= 1000
      );
  ELSE
    CREATE POLICY contact_messages_insert_policy ON public.contact_messages
      AS PERMISSIVE FOR INSERT TO anon, authenticated
      WITH CHECK (
        status = 'new'
        AND length(trim(message)) > 0
        AND length(message) <= 1000
      );
  END IF;
END
$security$;

-- ---------------------------------------------------------------------------
-- 8) Restrictive gates for application tables
-- ---------------------------------------------------------------------------
-- Restrictive policies are ANDed with every existing permissive policy, so an
-- older permissive policy can never turn a normal authenticated (or anon) user
-- into an administrator. Every condition here is a pure boolean check:
-- public.is_admin(). require_admin() is deliberately NOT used any more, because
-- it raises 42501 inside the condition and would break unrelated statements
-- (storage uploads, INSERT ... RETURNING, signed URLs) instead of just
-- filtering rows.
--   * public submission stays possible: services and jobs require
--     status = 'pending', contact_messages requires status = 'new'.
DO $security$
DECLARE
  item record;
  existing record;
  statement text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      -- table, policy, command, roles, USING, WITH CHECK
      ('services', 'wisal_gate_services_select', 'SELECT', 'anon, authenticated', '(status = ''approved'' OR public.is_admin())', NULL),
      ('services', 'wisal_gate_services_insert', 'INSERT', 'anon, authenticated', NULL, '(status = ''pending'' OR public.is_admin())'),
      ('services', 'wisal_gate_services_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('services', 'wisal_gate_services_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('categories', 'wisal_gate_categories_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('categories', 'wisal_gate_categories_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('categories', 'wisal_gate_categories_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('slider_images', 'wisal_gate_slider_images_select', 'SELECT', 'anon, authenticated', '(is_active = true OR public.is_admin())', NULL),
      ('slider_images', 'wisal_gate_slider_images_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('slider_images', 'wisal_gate_slider_images_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('slider_images', 'wisal_gate_slider_images_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('jobs', 'wisal_gate_jobs_select', 'SELECT', 'anon, authenticated', '(status = ''approved'' OR public.is_admin())', NULL),
      ('jobs', 'wisal_gate_jobs_insert', 'INSERT', 'anon, authenticated', NULL, '(status = ''pending'' OR public.is_admin())'),
      ('jobs', 'wisal_gate_jobs_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('jobs', 'wisal_gate_jobs_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('job_categories', 'wisal_gate_job_categories_select', 'SELECT', 'anon, authenticated', '(is_visible = true OR public.is_admin())', NULL),
      ('job_categories', 'wisal_gate_job_categories_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('job_categories', 'wisal_gate_job_categories_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('job_categories', 'wisal_gate_job_categories_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('job_slides', 'wisal_gate_job_slides_select', 'SELECT', 'anon, authenticated', '(is_visible = true OR public.is_admin())', NULL),
      ('job_slides', 'wisal_gate_job_slides_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('job_slides', 'wisal_gate_job_slides_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('job_slides', 'wisal_gate_job_slides_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('job_slider_settings', 'wisal_gate_job_slider_settings_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('job_slider_settings', 'wisal_gate_job_slider_settings_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('job_slider_settings', 'wisal_gate_job_slider_settings_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('contact_messages', 'wisal_gate_contact_messages_select', 'SELECT', 'anon, authenticated', 'public.is_admin()', NULL),
      ('contact_messages', 'wisal_gate_contact_messages_insert', 'INSERT', 'anon, authenticated', NULL, '(status = ''new'')'),
      ('contact_messages', 'wisal_gate_contact_messages_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('contact_messages', 'wisal_gate_contact_messages_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('admin_notifications', 'wisal_gate_admin_notifications_select', 'SELECT', 'anon, authenticated', '(published_at IS NOT NULL OR public.is_admin())', NULL),
      ('admin_notifications', 'wisal_gate_admin_notifications_insert', 'INSERT', 'anon, authenticated', NULL, 'public.is_admin()'),
      ('admin_notifications', 'wisal_gate_admin_notifications_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('admin_notifications', 'wisal_gate_admin_notifications_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL),

      ('job_applications', 'wisal_gate_job_applications_select', 'SELECT', 'anon, authenticated', 'public.is_admin()', NULL),
      ('job_applications', 'wisal_gate_job_applications_update', 'UPDATE', 'anon, authenticated', 'public.is_admin()', 'public.is_admin()'),
      ('job_applications', 'wisal_gate_job_applications_delete', 'DELETE', 'anon, authenticated', 'public.is_admin()', NULL)
    ) AS policies(table_name, policy_name, command_name, role_list, using_expression, check_expression)
  LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item.table_name);

    SELECT permissive, cmd
      INTO existing
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = item.table_name
      AND policyname = item.policy_name;

    IF FOUND AND (existing.permissive <> 'RESTRICTIVE' OR existing.cmd <> item.command_name) THEN
      RAISE EXCEPTION 'Policy %.% exists with an incompatible type; no changes were committed', item.table_name, item.policy_name;
    END IF;

    -- A policy created by an earlier revision of this file is refreshed in
    -- place, so an old condition (for example one calling require_admin())
    -- is replaced by the reviewed boolean condition instead of being kept.
    IF FOUND THEN
      statement := format(
        'ALTER POLICY %I ON public.%I TO %s',
        item.policy_name, item.table_name, item.role_list
      );
    ELSE
      statement := format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO %s',
        item.policy_name, item.table_name, item.command_name, item.role_list
      );
    END IF;

    IF item.using_expression IS NOT NULL THEN
      statement := statement || ' USING (' || item.using_expression || ')';
    END IF;
    IF item.check_expression IS NOT NULL THEN
      statement := statement || ' WITH CHECK (' || item.check_expression || ')';
    END IF;

    EXECUTE statement;
  END LOOP;
END
$security$;

-- ---------------------------------------------------------------------------
-- 9) Storage gates (RESTRICTIVE — they never grant access by themselves)
-- ---------------------------------------------------------------------------
-- Real paths used by the application (src/lib/serviceMediaStorage.ts):
--   service-media/slider/...      slider images     -> admin only
--   service-media/contact/...     suggestion images -> public upload keeps working
--   service-media/jobs/images/... job images        -> public upload keeps working
--   service-media/jobs/videos/... job videos        -> public upload keeps working
-- Other buckets (slider-images, services-images, job-applications, ...) keep
-- their existing permissive policies:
--   * job-applications stays publicly insertable only through its own
--     constrained permissive upload policy; reads/deletes remain admin-only.
--   * services-images (comment images) is untouched.
-- Path checks use coalesce(...) so a path with no folders ('file.jpg', legacy
-- objects stored at the bucket root) is never blocked by NULL boolean logic.
DO $security$
DECLARE
  existing record;
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    SELECT permissive, cmd INTO existing
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'wisal_gate_admin_storage_select';
    IF FOUND AND (existing.permissive <> 'RESTRICTIVE' OR existing.cmd <> 'SELECT') THEN
      RAISE EXCEPTION 'Storage policy wisal_gate_admin_storage_select has an incompatible type';
    END IF;
    IF FOUND THEN
      ALTER POLICY wisal_gate_admin_storage_select
        ON storage.objects TO anon, authenticated
        USING (bucket_id <> 'job-applications' OR public.is_admin());
    ELSE
      CREATE POLICY wisal_gate_admin_storage_select
        ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
        USING (bucket_id <> 'job-applications' OR public.is_admin());
    END IF;

    SELECT permissive, cmd INTO existing
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'wisal_gate_admin_storage_insert';
    IF FOUND AND (existing.permissive <> 'RESTRICTIVE' OR existing.cmd <> 'INSERT') THEN
      RAISE EXCEPTION 'Storage policy wisal_gate_admin_storage_insert has an incompatible type';
    END IF;
    IF FOUND THEN
      ALTER POLICY wisal_gate_admin_storage_insert
        ON storage.objects TO anon, authenticated
        WITH CHECK (
          bucket_id NOT IN ('slider-images', 'service-media')
          OR public.is_admin()
          OR (
            bucket_id = 'service-media'
            AND (
              coalesce((storage.foldername(name))[1], '') = 'contact'
              OR (
                coalesce((storage.foldername(name))[1], '') = 'jobs'
                AND coalesce((storage.foldername(name))[2], '') IN ('images', 'videos')
              )
            )
          )
        );
    ELSE
      CREATE POLICY wisal_gate_admin_storage_insert
        ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
        WITH CHECK (
          bucket_id NOT IN ('slider-images', 'service-media')
          OR public.is_admin()
          OR (
            bucket_id = 'service-media'
            AND (
              coalesce((storage.foldername(name))[1], '') = 'contact'
              OR (
                coalesce((storage.foldername(name))[1], '') = 'jobs'
                AND coalesce((storage.foldername(name))[2], '') IN ('images', 'videos')
              )
            )
          )
        );
    END IF;

    SELECT permissive, cmd INTO existing
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'wisal_gate_admin_storage_update';
    IF FOUND AND (existing.permissive <> 'RESTRICTIVE' OR existing.cmd <> 'UPDATE') THEN
      RAISE EXCEPTION 'Storage policy wisal_gate_admin_storage_update has an incompatible type';
    END IF;
    IF FOUND THEN
      ALTER POLICY wisal_gate_admin_storage_update
        ON storage.objects TO anon, authenticated
        USING (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        )
        WITH CHECK (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        );
    ELSE
      CREATE POLICY wisal_gate_admin_storage_update
        ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
        USING (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        )
        WITH CHECK (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        );
    END IF;

    SELECT permissive, cmd INTO existing
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'wisal_gate_admin_storage_delete';
    IF FOUND AND (existing.permissive <> 'RESTRICTIVE' OR existing.cmd <> 'DELETE') THEN
      RAISE EXCEPTION 'Storage policy wisal_gate_admin_storage_delete has an incompatible type';
    END IF;
    IF FOUND THEN
      ALTER POLICY wisal_gate_admin_storage_delete
        ON storage.objects TO anon, authenticated
        USING (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        );
    ELSE
      CREATE POLICY wisal_gate_admin_storage_delete
        ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
        USING (
          (
            bucket_id NOT IN ('slider-images', 'job-applications')
            AND NOT (
              bucket_id = 'service-media'
              AND coalesce((storage.foldername(name))[1], '') = 'slider'
            )
          )
          OR public.is_admin()
        );
    END IF;
  END IF;
END
$security$;

COMMIT;

-- ===========================================================================
-- Review-only verification output (read-only; modifies nothing).
-- Run this whole file at once, then check the four SELECTs below.
-- ===========================================================================

-- 1) Every gate created/refreshed by this file, with its final condition.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE policyname LIKE 'wisal_gate_%'
ORDER BY schemaname, tablename, cmd, policyname;

-- 2) Every admin_* function: which role may execute it, and is it INVOKER?
SELECT
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  position('is_admin' IN lower(p.prosrc)) > 0               AS body_asserts_admin
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND left(p.proname, 6) = 'admin_'
ORDER BY function_signature::text;

-- 3) Effective table privileges after the grants/revokes above.
--    Expected: anon has no DELETE/UPDATE anywhere, jobs delete is authenticated
--    only, contact_messages INSERT is available to anon.
SELECT
  t AS table_name,
  has_table_privilege('anon', t, 'SELECT')          AS anon_select,
  has_table_privilege('anon', t, 'INSERT')          AS anon_insert,
  has_table_privilege('anon', t, 'UPDATE')          AS anon_update,
  has_table_privilege('anon', t, 'DELETE')          AS anon_delete,
  has_table_privilege('authenticated', t, 'SELECT') AS auth_select,
  has_table_privilege('authenticated', t, 'DELETE') AS auth_delete
FROM unnest(ARRAY[
  'public.services',
  'public.jobs',
  'public.job_categories',
  'public.job_slides',
  'public.job_slider_settings',
  'public.contact_messages',
  'public.job_applications',
  'public.admin_notifications'
]) AS t
ORDER BY table_name;

-- 4) Storage gates only (the four RESTRICTIVE policies on storage.objects).
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'wisal_gate_admin_storage_%'
ORDER BY cmd, policyname;