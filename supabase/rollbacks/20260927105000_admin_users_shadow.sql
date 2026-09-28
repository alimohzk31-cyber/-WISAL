-- WISAL phase 1 rollback. NOT RUN automatically.
-- Only while the shadow table has NOT become live authorization.
-- RESTRICT and one transaction prevent deleting unrelated/later objects.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';
DO $rollback$
BEGIN
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure))
       <> 'fb97527d03c3c8b0fc8a5e83f2a59066'
     OR pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: live authorization changed; phase-1 rollback no longer safe';
  END IF;
  IF pg_catalog.obj_description('private.admin_users'::regclass, 'pg_class')
       IS DISTINCT FROM 'WISAL phase1 admin shadow 20260927105000; not live authorization' THEN
    RAISE EXCEPTION 'STOP: table ownership marker does not match this migration';
  END IF;
  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM private.admin_users AS a
       JOIN public.profiles AS p ON p.id = a.user_id
       WHERE a.active AND p.role = 'admin'
         AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(a.user_id::text, 'UTF8')), 'hex')
           = '045b30ff538f747438efce4d070abeae93f24264d78722968e9507e56bc0d6ea'
     ) THEN
    RAISE EXCEPTION 'STOP: shadow membership changed; review rollback manually';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND p.prosrc ~* 'admin_users'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE COALESCE(qual, '') || COALESCE(with_check, '') ~* 'admin_users'
  ) THEN
    RAISE EXCEPTION 'STOP: a function/policy now references the shadow table';
  END IF;
END;
$rollback$;
DROP TABLE private.admin_users RESTRICT;
-- This schema was absent at preflight and created exclusively by phase 1.
-- If another object has been added meanwhile, this fails and rolls back the DROP above.
DROP SCHEMA private RESTRICT;
COMMIT;
