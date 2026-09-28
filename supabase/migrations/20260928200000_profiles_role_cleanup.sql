-- WISAL phase 4: remove the legacy public.profiles.role authority surface.
-- Prepared locally only. Do not apply to Remote without explicit approval.
-- This migration never changes private.admin_users or either admin authority
-- function. It fails closed if the reviewed Remote baseline is not present.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';

DO $phase4_preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: this reviewed migration requires the postgres maintenance role';
  END IF;
  IF pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('private.admin_users') IS NULL THEN
    RAISE EXCEPTION 'STOP: reviewed profiles/admin_users objects are missing';
  END IF;
END;
$phase4_preflight$;

-- Prevent a new auth user from running the old trigger while the profile
-- column and trigger function are being changed.
LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
LOCK TABLE auth.users IN SHARE MODE;
LOCK TABLE private.admin_users IN SHARE MODE;

DO $phase4_precheck$
DECLARE
  v_role_type oid;
  v_role_not_null boolean;
  v_role_default text;
  v_role_constraint_count integer;
  v_role_constraint_definition text;
  v_handle_body text;
  v_is_owner_body text;
  v_is_admin_body text;
  v_admin_login_body text;
  v_policy_hash text;
  v_acl aclitem[];
  v_owner oid;
  v_config text[];
BEGIN
  -- Phase 4 is allowed only on the reviewed one-admin private authority.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class
    WHERE oid = 'private.admin_users'::regclass
      AND relrowsecurity
      AND relforcerowsecurity
      AND pg_catalog.pg_get_userbyid(relowner) = 'postgres'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'private'
  ) OR (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1 THEN
    RAISE EXCEPTION 'STOP: private.admin_users is not the reviewed protected one-admin authority';
  END IF;

  -- Never touch public.is_admin(); verify its reviewed phase-2 body and
  -- retain its owner, ACL, and security metadata across the migration.
  SELECT
    p.proacl,
    p.proowner,
    p.proconfig,
    pg_catalog.regexp_replace(
      pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
      ';+$', '', 'g'
    )
  INTO v_acl, v_owner, v_config, v_is_admin_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.is_admin()')
    AND p.prorettype = 'pg_catalog.bool'::regtype
    AND p.pronargs = 0
    AND p.prosecdef
    AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres';

  IF NOT FOUND
     OR v_is_admin_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=auth.uid()andactive=true)' THEN
    RAISE EXCEPTION 'STOP: public.is_admin() security metadata/body differs from the reviewed phase-2 private authority';
  END IF;
  IF pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) ~* 'public[[:space:]]*\.[[:space:]]*profiles' THEN
    RAISE EXCEPTION 'STOP: public.is_admin() still references public.profiles';
  END IF;
  PERFORM pg_catalog.set_config('phase4.is_admin_acl', COALESCE(v_acl::text, '<NULL>'), true);
  PERFORM pg_catalog.set_config('phase4.is_admin_owner', v_owner::text, true);
  PERFORM pg_catalog.set_config('phase4.is_admin_config', COALESCE(v_config::text, '<NULL>'), true);

  -- The Edge Function bridge is also immutable in this phase.
  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_admin_login_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)')
    AND p.prorettype = 'pg_catalog.bool'::regtype
    AND p.pronargs = 1
    AND p.proargtypes[0] = 'pg_catalog.uuid'::regtype::oid
    AND p.prosecdef
    AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    AND NOT pg_catalog.has_function_privilege('anon', 'public.admin_login_is_active(uuid)', 'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('authenticated', 'public.admin_login_is_active(uuid)', 'EXECUTE')
    AND pg_catalog.has_function_privilege('service_role', 'public.admin_login_is_active(uuid)', 'EXECUTE');
  IF NOT FOUND
     OR v_admin_login_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=p_user_idandactive=true)' THEN
    RAISE EXCEPTION 'STOP: public.admin_login_is_active(uuid) is not the reviewed private bridge';
  END IF;
  SELECT p.proacl, p.proowner, p.proconfig
  INTO v_acl, v_owner, v_config
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)');
  PERFORM pg_catalog.set_config('phase4.admin_login_acl', COALESCE(v_acl::text, '<NULL>'), true);
  PERFORM pg_catalog.set_config('phase4.admin_login_owner', v_owner::text, true);
  PERFORM pg_catalog.set_config('phase4.admin_login_config', COALESCE(v_config::text, '<NULL>'), true);

  -- The reviewed Remote baseline creates every new profile with role='user'.
  -- Any other live definition stops here.
  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_handle_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.handle_new_user()')
    AND p.prorettype = 'pg_catalog.trigger'::regtype
    AND p.pronargs = 0
    AND p.prosecdef
    AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    AND p.proconfig @> ARRAY['search_path=public'];
  IF NOT FOUND
     OR v_handle_body <> 'begininsertintopublic.profiles(id,full_name,role)values(new.id,coalesce(new.raw_user_meta_data->>''full_name'',new.email),''user'')onconflict(id)donothing;returnnew;end' THEN
    RAISE EXCEPTION 'STOP: public.handle_new_user() differs from the reviewed pre-cleanup definition';
  END IF;

  IF pg_catalog.to_regprocedure('public.guard_profile_role_change()') IS NULL THEN
    RAISE EXCEPTION 'STOP: guard_profile_role_change() is missing';
  END IF;
  IF pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
       <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: guard_profile_role_change() differs from the reviewed definition';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS t
    WHERE t.tgrelid = 'public.profiles'::regclass
      AND t.tgname = 'profile_role_guard'
      AND t.tgenabled = 'O'
      AND t.tgfoid = 'public.guard_profile_role_change()'::regprocedure
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: reviewed profile_role_guard trigger is missing or changed';
  END IF;

  SELECT a.atttypid, a.attnotnull, pg_catalog.pg_get_expr(d.adbin, d.adrelid)
  INTO v_role_type, v_role_not_null, v_role_default
  FROM pg_catalog.pg_attribute AS a
  LEFT JOIN pg_catalog.pg_attrdef AS d
    ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attrelid = 'public.profiles'::regclass
    AND a.attname = 'role'
    AND NOT a.attisdropped;
  IF NOT FOUND
     OR v_role_type <> 'pg_catalog.text'::regtype
     OR NOT v_role_not_null
     OR pg_catalog.regexp_replace(pg_catalog.lower(COALESCE(v_role_default, '')), '[[:space:]]+', '', 'g') <> '''user''::text' THEN
    RAISE EXCEPTION 'STOP: public.profiles.role type/nullability/default differs from the reviewed baseline';
  END IF;

  SELECT count(*), max(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.pg_get_constraintdef(c.oid, true)), '[[:space:]]+', '', 'g'))
  INTO v_role_constraint_count, v_role_constraint_definition
  FROM pg_catalog.pg_constraint AS c
  WHERE c.conrelid = 'public.profiles'::regclass
    AND c.conname = 'profiles_role_check'
    AND c.contype = 'c'
    AND c.convalidated
    AND c.conkey @> ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid = c.conrelid AND attname = 'role')]::smallint[];
  IF v_role_constraint_count <> 1
     OR v_role_constraint_definition <> 'check((role=any(array[''user''::text,''owner''::text,''admin''::text])))' THEN
    RAISE EXCEPTION 'STOP: profiles_role_check differs from the reviewed baseline';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_is_owner_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.is_owner()')
    AND p.prorettype = 'pg_catalog.bool'::regtype
    AND p.pronargs = 0
    AND p.prosecdef
    AND p.provolatile = 's'
    AND p.proconfig @> ARRAY['search_path=public'];
  IF NOT FOUND
     OR v_is_owner_body <> 'selectexists(select1frompublic.profileswhereid=auth.uid()androle=''owner'')' THEN
    RAISE EXCEPTION 'STOP: public.is_owner() differs from the reviewed baseline';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_depend
    WHERE objid = pg_catalog.to_regprocedure('public.is_owner()')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc AS p
    WHERE p.oid <> pg_catalog.to_regprocedure('public.is_owner()')
      AND p.prosrc ~* '(^|[^a-z_])is_owner[[:space:]]*\('
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies AS p
    WHERE COALESCE(p.qual, '') || COALESCE(p.with_check, '') ~* '(^|[^a-z_])is_owner[[:space:]]*\('
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND pg_catalog.pg_get_viewdef(c.oid, true) ~* '(^|[^a-z_])is_owner[[:space:]]*\('
  ) THEN
    RAISE EXCEPTION 'STOP: public.is_owner() has live dependencies; removal refused';
  END IF;

  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
  INTO v_policy_hash
  FROM pg_catalog.pg_policies AS p
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: live RLS policies differ from the reviewed baseline';
  END IF;
  PERFORM pg_catalog.set_config('phase4.policy_hash', v_policy_hash, true);
END;
$phase4_precheck$;

-- The new auth trigger keeps the existing identity/full-name behavior but no
-- longer writes or reads public.profiles.role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

DROP TRIGGER profile_role_guard ON public.profiles;
DROP FUNCTION public.guard_profile_role_change();
DROP FUNCTION public.is_owner();
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles DROP COLUMN role;

DO $phase4_postcheck$
DECLARE
  v_handle_body text;
  v_is_admin_body text;
  v_admin_login_body text;
  v_policy_hash text;
  v_acl aclitem[];
  v_owner oid;
  v_config text[];
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'role'
      AND NOT attisdropped
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'profile_role_guard'
      AND NOT tgisinternal
  ) OR pg_catalog.to_regprocedure('public.guard_profile_role_change()') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.is_owner()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: legacy profiles.role objects remain after cleanup';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_handle_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.handle_new_user()')
    AND p.prorettype = 'pg_catalog.trigger'::regtype
    AND p.pronargs = 0
    AND p.prosecdef
    AND pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
    AND p.proconfig @> ARRAY['search_path=public'];
  IF NOT FOUND
     OR v_handle_body <> 'begininsertintopublic.profiles(id,full_name)values(new.id,coalesce(new.raw_user_meta_data->>''full_name'',new.email))onconflict(id)donothing;returnnew;end' THEN
    RAISE EXCEPTION 'STOP: handle_new_user() was not rewritten to the reviewed role-free definition';
  END IF;

  SELECT p.proacl, p.proowner, p.proconfig,
         pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g')
  INTO v_acl, v_owner, v_config, v_is_admin_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.is_admin()')
    AND p.prosecdef;
  IF NOT FOUND
     OR v_is_admin_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=auth.uid()andactive=true)'
     OR v_acl::text IS DISTINCT FROM NULLIF(pg_catalog.current_setting('phase4.is_admin_acl', true), '<NULL>')
     OR v_owner::text IS DISTINCT FROM pg_catalog.current_setting('phase4.is_admin_owner', true)
     OR COALESCE(v_config::text, '<NULL>') IS DISTINCT FROM pg_catalog.current_setting('phase4.is_admin_config', true)
     OR pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) ~* 'public[[:space:]]*\.[[:space:]]*profiles' THEN
    RAISE EXCEPTION 'STOP: public.is_admin() changed or no longer uses private.admin_users only';
  END IF;

  SELECT p.proacl, p.proowner, p.proconfig,
         pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g')
  INTO v_acl, v_owner, v_config, v_admin_login_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)')
    AND p.prosecdef;
  IF NOT FOUND
     OR v_admin_login_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=p_user_idandactive=true)'
     OR v_acl::text IS DISTINCT FROM NULLIF(pg_catalog.current_setting('phase4.admin_login_acl', true), '<NULL>')
     OR v_owner::text IS DISTINCT FROM pg_catalog.current_setting('phase4.admin_login_owner', true)
     OR COALESCE(v_config::text, '<NULL>') IS DISTINCT FROM pg_catalog.current_setting('phase4.admin_login_config', true) THEN
    RAISE EXCEPTION 'STOP: public.admin_login_is_active(uuid) changed unexpectedly';
  END IF;

  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
  INTO v_policy_hash
  FROM pg_catalog.pg_policies AS p
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> pg_catalog.current_setting('phase4.policy_hash', true) THEN
    RAISE EXCEPTION 'STOP: live RLS policies changed during cleanup';
  END IF;

  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1 THEN
    RAISE EXCEPTION 'STOP: private.admin_users changed during cleanup';
  END IF;
END;
$phase4_postcheck$;

COMMIT;
