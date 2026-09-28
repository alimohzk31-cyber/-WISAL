-- WISAL phase 2: switch only public.is_admin() to the phase-1 shadow table.
-- Prepared locally only. Do not apply to Remote without explicit approval.
-- No profile row, PIN, admin-login code, RLS policy, or account is changed.
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
END;
$preflight$;

-- Freeze the two read-only inputs while the authority decision is switched.
LOCK TABLE public.profiles IN SHARE MODE;
LOCK TABLE private.admin_users IN SHARE MODE;

DO $phase2_precheck$
DECLARE
  v_policy_hash text;
  v_acl aclitem[];
  v_owner oid;
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
     OR (SELECT count(*) FROM public.profiles WHERE role = 'admin') <> 1
     OR EXISTS (
       SELECT 1 FROM auth.users AS u
       LEFT JOIN public.profiles AS p ON p.id = u.id
       LEFT JOIN private.admin_users AS a ON a.user_id = u.id
       WHERE COALESCE(p.role = 'admin', false) <> COALESCE(a.active, false)
     ) THEN
    RAISE EXCEPTION 'STOP: old profiles authority and phase-1 shadow authority do not match';
  END IF;

  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure))
       <> 'fb97527d03c3c8b0fc8a5e83f2a59066' THEN
    RAISE EXCEPTION 'STOP: current public.is_admin() is not the reviewed profiles-based definition';
  END IF;
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: guard_profile_role_change() differs from the reviewed definition';
  END IF;

  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
    INTO v_policy_hash
    FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: existing RLS policies differ from the reviewed baseline';
  END IF;

  SELECT p.proacl, p.proowner INTO v_acl, v_owner
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'public.is_admin()'::regprocedure
      AND p.prorettype = 'pg_catalog.bool'::regtype
      AND p.pronargs = 0
      AND p.prosecdef;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOP: public.is_admin() signature/security metadata differs';
  END IF;

  PERFORM pg_catalog.set_config('phase2.is_admin_acl', COALESCE(v_acl::text, ''), true);
  PERFORM pg_catalog.set_config('phase2.is_admin_owner', v_owner::text, true);
END;
$phase2_precheck$;

-- Same public name/signature and SECURITY DEFINER; only the authority source changes.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM private.admin_users
    WHERE user_id = auth.uid()
      AND active = true
  );
$function$;

DO $phase2_postcheck$
DECLARE
  v_policy_hash text;
  v_acl aclitem[];
  v_owner oid;
  v_prosrc text;
  -- Compare the normalized SQL body, not pg_get_functiondef/prosrc formatting.
  -- Whitespace and the optional final semicolon are not semantically relevant.
  v_expected_body text := 'selectexists(select1fromprivate.admin_userswhereuser_id=auth.uid()andactive=true)';
BEGIN
  SELECT p.proacl, p.proowner,
         pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g')
    INTO v_acl, v_owner, v_prosrc
    FROM pg_catalog.pg_proc AS p
    WHERE p.oid = 'public.is_admin()'::regprocedure
      AND p.prorettype = 'pg_catalog.bool'::regtype
      AND p.pronargs = 0
      AND p.prosecdef;
  IF NOT FOUND OR v_prosrc <> v_expected_body THEN
    RAISE EXCEPTION 'STOP: new public.is_admin() body/signature/security is not the reviewed definition';
  END IF;
  IF v_acl::text IS DISTINCT FROM NULLIF(pg_catalog.current_setting('phase2.is_admin_acl', true), '')
     OR v_owner::text IS DISTINCT FROM pg_catalog.current_setting('phase2.is_admin_owner', true) THEN
    RAISE EXCEPTION 'STOP: public.is_admin() owner or ACL changed unexpectedly';
  END IF;
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: guard_profile_role_change() changed during migration';
  END IF;

  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
    INTO v_policy_hash
    FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: existing RLS policies changed during migration';
  END IF;

  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1
     OR EXISTS (
       SELECT 1 FROM auth.users AS u
       LEFT JOIN public.profiles AS p ON p.id = u.id
       LEFT JOIN private.admin_users AS a ON a.user_id = u.id
       WHERE COALESCE(p.role = 'admin', false) <> COALESCE(a.active, false)
     ) THEN
    RAISE EXCEPTION 'STOP: old/new admin decisions diverged during migration';
  END IF;
END;
$phase2_postcheck$;
COMMIT;
