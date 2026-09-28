-- WISAL phase 3: narrow DB bridge for the admin-login Edge Function.
-- Prepared locally only. Do not apply to Remote without explicit approval.
-- The bridge is the only Data API entry point to private.admin_users.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: this reviewed migration requires the postgres maintenance role';
  END IF;
  IF pg_catalog.to_regclass('private.admin_users') IS NULL THEN
    RAISE EXCEPTION 'STOP: private.admin_users is missing; phase 1 must be present first';
  END IF;
  IF pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: admin_login_is_active(uuid) already exists; review before replaying';
  END IF;
END;
$preflight$;

DO $phase3_precheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid = 'private.admin_users'::regclass
      AND relrowsecurity AND relforcerowsecurity
      AND pg_catalog.pg_get_userbyid(relowner) = 'postgres'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'private'
  ) THEN
    RAISE EXCEPTION 'STOP: private.admin_users protection differs from phase 1';
  END IF;
  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1
     OR EXISTS (
       SELECT 1 FROM auth.users AS u
       LEFT JOIN private.admin_users AS a ON a.user_id = u.id
       WHERE COALESCE(a.active, false) AND u.deleted_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'STOP: private.admin_users is not the reviewed active administrator set';
  END IF;
  IF pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) !~* 'private\.admin_users'
     OR pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) ~* 'public\.profiles' THEN
    RAISE EXCEPTION 'STOP: phase 2 public.is_admin() authority is not active';
  END IF;
END;
$phase3_precheck$;

-- SECURITY DEFINER is required because private is intentionally not exposed.
-- The function returns one boolean and is executable only by service_role.
CREATE FUNCTION public.admin_login_is_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.admin_users
    WHERE user_id = p_user_id
      AND active = true
  );
$function$;

ALTER FUNCTION public.admin_login_is_active(uuid) OWNER TO postgres;
COMMENT ON FUNCTION public.admin_login_is_active(uuid) IS
  'WISAL phase3 admin-login bridge; boolean only; private.admin_users authority';
REVOKE ALL ON FUNCTION public.admin_login_is_active(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_login_is_active(uuid) TO service_role;

DO $phase3_postcheck$
DECLARE
  v_prosrc text;
  v_expected_body text := 'selectexists(select1fromprivate.admin_userswhereuser_id=p_user_idandactive=true)';
BEGIN
  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g')
    INTO v_prosrc
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'public.admin_login_is_active(uuid)'::regprocedure
      AND p.prorettype = 'pg_catalog.bool'::regtype
      AND p.pronargs = 1
      AND p.proargtypes[0] = 'pg_catalog.uuid'::regtype::oid
      AND p.prosecdef
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres';
  IF NOT FOUND OR v_prosrc <> v_expected_body THEN
    RAISE EXCEPTION 'STOP: admin_login_is_active() body/signature/security is not the reviewed definition';
  END IF;
  IF pg_catalog.has_function_privilege('anon', 'public.admin_login_is_active(uuid)', 'EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated', 'public.admin_login_is_active(uuid)', 'EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role', 'public.admin_login_is_active(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'STOP: admin-login bridge grants are not fail-closed';
  END IF;
END;
$phase3_postcheck$;
COMMIT;
