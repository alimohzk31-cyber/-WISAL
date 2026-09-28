-- Read-only verification. Run as the trusted maintenance role, never via a public RPC.
-- Transaction-local auth.uid() fixtures do not create Auth sessions or change users.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';
DO $verify$
DECLARE
  v_admin_id uuid;
  v_user_id uuid;
  v_claim_sub text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  v_policy_hash text;
  v_role text;
BEGIN
  IF pg_catalog.current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'FAIL: verification must be read-only';
  END IF;
  SELECT p.id INTO STRICT v_admin_id
    FROM public.profiles AS p JOIN auth.users AS u ON u.id = p.id
    WHERE p.role = 'admin'
      AND pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.id::text, 'UTF8')), 'hex')
        = '045b30ff538f747438efce4d070abeae93f24264d78722968e9507e56bc0d6ea'
      AND pg_catalog.md5(pg_catalog.to_jsonb(p)::text) = '48afd8daf88c36c1c4562b533b184d10'
      AND pg_catalog.md5(pg_catalog.jsonb_build_object(
        'id',u.id,'deleted_at',u.deleted_at,'banned_until',u.banned_until,
        'is_anonymous',u.is_anonymous)::text) = '012717593fcf2c50f409c5c34870347b';
  IF (SELECT count(*) FROM public.profiles WHERE role = 'admin') <> 1
     OR (SELECT count(*) FROM private.admin_users) <> 1
     OR NOT EXISTS (SELECT 1 FROM private.admin_users WHERE user_id = v_admin_id AND active) THEN
    RAISE EXCEPTION 'FAIL: expected one unchanged administrator and one matching active shadow row';
  END IF;

  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure))
       <> 'fb97527d03c3c8b0fc8a5e83f2a59066'
     OR pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'FAIL: protected function changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
      WHERE tgrelid='public.profiles'::regclass AND tgname='profile_role_guard'
        AND tgenabled='O' AND tgfoid='public.guard_profile_role_change()'::regprocedure
        AND pg_catalog.pg_get_triggerdef(oid) =
          'CREATE TRIGGER profile_role_guard BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION guard_profile_role_change()') THEN
    -- pg_get_triggerdef qualification depends on search_path, so also accept its
    -- fully qualified equivalent while requiring the same trigger identity/events.
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
        WHERE tgrelid='public.profiles'::regclass AND tgname='profile_role_guard'
          AND tgenabled='O' AND tgfoid='public.guard_profile_role_change()'::regprocedure
          AND pg_catalog.pg_get_triggerdef(oid) =
            'CREATE TRIGGER profile_role_guard BEFORE UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change()') THEN
      RAISE EXCEPTION 'FAIL: profile role guard trigger changed';
    END IF;
  END IF;
  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname,p.tablename,p.policyname)::text, '[]'))
    INTO v_policy_hash FROM pg_catalog.pg_policies AS p
    WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'FAIL: existing RLS policies changed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class
      WHERE oid='private.admin_users'::regclass AND relrowsecurity AND relforcerowsecurity
        AND pg_catalog.pg_get_userbyid(relowner)='postgres')
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname='private')
     OR (SELECT count(*) FROM pg_catalog.pg_attribute
         WHERE attrelid='private.admin_users'::regclass AND attnum>0 AND NOT attisdropped) <> 3
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
         WHERE conrelid='private.admin_users'::regclass AND contype='f'
           AND confrelid='auth.users'::regclass AND confdeltype='r' AND confupdtype='r') THEN
    RAISE EXCEPTION 'FAIL: shadow table protection/shape differs from the reviewed migration';
  END IF;
  FOREACH v_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF pg_catalog.has_schema_privilege(v_role,'private','USAGE,CREATE')
       OR pg_catalog.has_table_privilege(v_role,'private.admin_users',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege(v_role,'private.admin_users','INSERT,UPDATE') THEN
      RAISE EXCEPTION 'FAIL: direct client access to shadow membership';
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id=u.id
    LEFT JOIN private.admin_users AS a ON a.user_id=u.id
    WHERE COALESCE(p.role='admin',false) <> COALESCE(a.active,false)
  ) THEN
    RAISE EXCEPTION 'FAIL: old/new decisions disagree';
  END IF;

  PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_admin_id::text,true);
  IF public.is_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: unchanged is_admin denies the current administrator';
  END IF;
  FOR v_user_id IN
    SELECT u.id FROM auth.users AS u
    LEFT JOIN public.profiles AS p ON p.id=u.id
    WHERE NOT COALESCE(p.role='admin',false) AND u.deleted_at IS NULL
  LOOP
    PERFORM pg_catalog.set_config('request.jwt.claim.sub',v_user_id::text,true);
    IF public.is_admin() IS DISTINCT FROM false
       OR EXISTS (SELECT 1 FROM private.admin_users WHERE user_id=v_user_id AND active) THEN
      RAISE EXCEPTION 'FAIL: ordinary account unexpectedly authorized';
    END IF;
  END LOOP;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub',COALESCE(v_claim_sub,''),true);
END;
$verify$;

SELECT
  pg_catalog.current_setting('transaction_read_only') AS read_only,
  'PASS'::text AS assertions,
  (SELECT count(*) FROM private.admin_users) AS shadow_rows,
  (SELECT bool_and(p.role='admin') FROM public.profiles AS p
     JOIN private.admin_users AS a ON a.user_id=p.id) AS old_auth_result,
  (SELECT bool_and(active) FROM private.admin_users) AS new_auth_result,
  (SELECT count(*) FROM auth.users AS u
     LEFT JOIN public.profiles AS p ON p.id=u.id
     WHERE NOT COALESCE(p.role='admin',false) AND u.deleted_at IS NULL) AS non_admin_accounts_checked,
  (SELECT count(*) FROM pg_catalog.pg_policies
     WHERE COALESCE(qual,'') || COALESCE(with_check,'') ~* 'is_admin') AS unchanged_admin_policy_count,
  NOT pg_catalog.has_table_privilege('anon','private.admin_users','INSERT,UPDATE,DELETE') AS anon_write_denied,
  NOT pg_catalog.has_table_privilege('authenticated','private.admin_users','INSERT,UPDATE,DELETE') AS authenticated_write_denied;
COMMIT;
