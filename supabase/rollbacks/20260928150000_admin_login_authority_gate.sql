-- WISAL phase 3 rollback: remove only the admin-login DB bridge.
-- Prepared locally only. Do not apply to Remote without explicit approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';

DO $preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: this reviewed rollback requires the postgres maintenance role';
  END IF;
  IF pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)') IS NULL THEN
    RAISE EXCEPTION 'STOP: admin_login_is_active(uuid) is absent; nothing to roll back';
  END IF;
END;
$preflight$;

DO $rollback_precheck$
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
      AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      AND pg_catalog.obj_description(p.oid, 'pg_proc') =
        'WISAL phase3 admin-login bridge; boolean only; private.admin_users authority';
  IF NOT FOUND OR v_prosrc <> v_expected_body THEN
    RAISE EXCEPTION 'STOP: bridge is not the reviewed phase-3 object; rollback refused';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE p.oid <> 'public.admin_login_is_active(uuid)'::regprocedure
      AND p.prosrc ~* 'admin_login_is_active'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies AS p
    WHERE COALESCE(p.qual, '') || COALESCE(p.with_check, '') ~* 'admin_login_is_active'
  ) THEN
    RAISE EXCEPTION 'STOP: another database object references the bridge; rollback refused';
  END IF;
END;
$rollback_precheck$;

DROP FUNCTION public.admin_login_is_active(uuid) RESTRICT;
COMMIT;
