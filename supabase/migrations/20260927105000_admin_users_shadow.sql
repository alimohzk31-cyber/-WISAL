-- WISAL phase 1: shadow authorization only. Project: nnxrjpitjxtceydlcxzm
-- Single-use migration; never replay historical SQL or change the live authority.
-- The UUID fingerprint pins the one administrator observed in preflight.
-- No PIN, account email, password, token, or profile data is copied.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';

-- Prevent a concurrent role/profile change between identity verification and copy.
-- Normal reads remain available; no profile rows are updated.
LOCK TABLE public.profiles IN SHARE MODE;

DO $phase1$
DECLARE
  v_admin_id uuid;
  v_count bigint;
  v_role text;
  v_policy_hash text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: this reviewed migration requires the postgres maintenance role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'private') THEN
    RAISE EXCEPTION 'STOP: private schema already exists; re-audit instead of merging or replaying';
  END IF;
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure))
       <> 'fb97527d03c3c8b0fc8a5e83f2a59066'
     OR pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: protected function definition differs from preflight';
  END IF;
  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
    INTO v_policy_hash
    FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: existing RLS policies differ from preflight';
  END IF;

  SELECT count(*) INTO v_count FROM public.profiles WHERE role = 'admin';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'STOP: exactly one existing administrator is required';
  END IF;
  SELECT p.id INTO STRICT v_admin_id
    FROM public.profiles AS p
    JOIN auth.users AS u ON u.id = p.id
    WHERE p.role = 'admin'
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.id::text, 'UTF8')), 'hex')
        = '045b30ff538f747438efce4d070abeae93f24264d78722968e9507e56bc0d6ea'
      AND NOT u.is_anonymous
      AND u.deleted_at IS NULL
      AND (u.banned_until IS NULL OR u.banned_until <= now())
      AND pg_catalog.md5(pg_catalog.to_jsonb(p)::text) = '48afd8daf88c36c1c4562b533b184d10';

  -- Hold only a key-share lock on the existing account; do not update auth.users.
  PERFORM u.id FROM auth.users AS u WHERE u.id = v_admin_id FOR KEY SHARE;

  CREATE SCHEMA private AUTHORIZATION postgres;
  COMMENT ON SCHEMA private IS 'WISAL phase1 admin shadow 20260927105000';
  REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated, service_role;

  CREATE TABLE private.admin_users (
    user_id uuid PRIMARY KEY,
    active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT admin_users_auth_user_fk FOREIGN KEY (user_id)
      REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT
  );
  ALTER TABLE private.admin_users OWNER TO postgres;
  COMMENT ON TABLE private.admin_users IS 'WISAL phase1 admin shadow 20260927105000; not live authorization';
  REVOKE ALL ON TABLE private.admin_users FROM PUBLIC, anon, authenticated, service_role;
  ALTER TABLE private.admin_users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE private.admin_users FORCE ROW LEVEL SECURITY;
  -- Intentionally no policies or client grants. postgres has BYPASSRLS.
  INSERT INTO private.admin_users (user_id, active) VALUES (v_admin_id, true);

  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM private.admin_users AS a
       JOIN public.profiles AS p ON p.id = a.user_id
       WHERE a.user_id = v_admin_id AND a.active AND p.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'STOP: copied identity/old-new authority mismatch';
  END IF;

  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF pg_catalog.has_schema_privilege(v_role, 'private', 'USAGE,CREATE')
       OR pg_catalog.has_table_privilege(v_role, 'private.admin_users',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege(v_role, 'private.admin_users', 'INSERT,UPDATE') THEN
      RAISE EXCEPTION 'STOP: unexpected direct client privilege';
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'private')
     OR EXISTS (
       SELECT 1 FROM auth.users AS u
       LEFT JOIN public.profiles AS p ON p.id = u.id
       LEFT JOIN private.admin_users AS a ON a.user_id = u.id
       WHERE COALESCE(p.role = 'admin', false) <> COALESCE(a.active, false)
     ) THEN
    RAISE EXCEPTION 'STOP: shadow authority mismatch or unexpected new policy';
  END IF;

  -- Recheck the unchanged live authority before committing any new object.
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure))
       <> 'fb97527d03c3c8b0fc8a5e83f2a59066'
     OR pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980'
     OR (SELECT pg_catalog.md5(pg_catalog.to_jsonb(p)::text)
         FROM public.profiles AS p WHERE p.id = v_admin_id) <> '48afd8daf88c36c1c4562b533b184d10' THEN
    RAISE EXCEPTION 'STOP: protected live authority changed';
  END IF;
  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
    INTO v_policy_hash
    FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: existing RLS policies changed';
  END IF;
END;
$phase1$;
COMMIT;
