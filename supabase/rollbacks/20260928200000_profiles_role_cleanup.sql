-- WISAL phase 4 rollback: restore the reviewed profiles.role compatibility
-- surface without restoring it as an administration authority.
-- Prepared locally only. Do not apply to Remote without explicit approval.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = '';

DO $rollback_preflight$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'STOP: this reviewed rollback requires the postgres maintenance role';
  END IF;
  IF pg_catalog.to_regclass('public.profiles') IS NULL
     OR pg_catalog.to_regclass('private.admin_users') IS NULL THEN
    RAISE EXCEPTION 'STOP: reviewed profiles/admin_users objects are missing';
  END IF;
END;
$rollback_preflight$;

LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;
LOCK TABLE auth.users IN SHARE MODE;
LOCK TABLE private.admin_users IN SHARE MODE;

DO $rollback_precheck$
DECLARE
  v_handle_body text;
  v_is_admin_body text;
  v_admin_login_body text;
  v_policy_hash text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'role'
      AND NOT attisdropped
  ) OR pg_catalog.to_regprocedure('public.guard_profile_role_change()') IS NOT NULL
     OR pg_catalog.to_regprocedure('public.is_owner()') IS NOT NULL THEN
    RAISE EXCEPTION 'STOP: current Remote is not the reviewed phase-4 cleaned state';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_handle_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.handle_new_user()')
    AND p.prosecdef
    AND p.proconfig @> ARRAY['search_path=public'];
  IF NOT FOUND
     OR v_handle_body <> 'begininsertintopublic.profiles(id,full_name)values(new.id,coalesce(new.raw_user_meta_data->>''full_name'',new.email))onconflict(id)donothing;returnnew;end' THEN
    RAISE EXCEPTION 'STOP: handle_new_user() is not the reviewed phase-4 definition';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_is_admin_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = 'public.is_admin()'::regprocedure
    AND p.prosecdef;
  IF NOT FOUND
     OR v_is_admin_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=auth.uid()andactive=true)'
     OR pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) ~* 'public[[:space:]]*\.[[:space:]]*profiles' THEN
    RAISE EXCEPTION 'STOP: public.is_admin() is not the unchanged private authority';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_admin_login_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.admin_login_is_active(uuid)')
    AND p.prosecdef
    AND NOT pg_catalog.has_function_privilege('anon', 'public.admin_login_is_active(uuid)', 'EXECUTE')
    AND NOT pg_catalog.has_function_privilege('authenticated', 'public.admin_login_is_active(uuid)', 'EXECUTE')
    AND pg_catalog.has_function_privilege('service_role', 'public.admin_login_is_active(uuid)', 'EXECUTE');
  IF NOT FOUND
     OR v_admin_login_body <> 'selectexists(select1fromprivate.admin_userswhereuser_id=p_user_idandactive=true)' THEN
    RAISE EXCEPTION 'STOP: public.admin_login_is_active(uuid) is not unchanged';
  END IF;

  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1 THEN
    RAISE EXCEPTION 'STOP: private.admin_users is not the reviewed protected one-admin authority';
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
END;
$rollback_precheck$;

ALTER TABLE public.profiles
  ADD COLUMN role text NOT NULL DEFAULT 'user';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'owner', 'admin'));

-- Restore the reviewed pre-cleanup bootstrap definition. It is not an admin
-- authority after phase 2 because public.is_admin() remains private-based.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
SELECT EXISTS (
SELECT 1
FROM public.profiles
WHERE id = auth.uid()
AND role = 'owner'
);
$function$;

CREATE OR REPLACE FUNCTION public.guard_profile_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    -- Only allow role changes if done by an admin (via is_admin RPC)
    -- The is_admin() call here uses the session's auth.uid()
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: only admins can modify user roles (profile id=%)', NEW.id;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE TRIGGER profile_role_guard
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role_change();

DO $rollback_postcheck$
DECLARE
  v_handle_body text;
  v_guard_hash text;
  v_is_owner_body text;
  v_policy_hash text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::regclass
      AND attname = 'role'
      AND atttypid = 'pg_catalog.text'::regtype
      AND attnotnull
      AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_role_check'
      AND contype = 'c'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'profile_role_guard'
      AND tgenabled = 'O'
      AND tgfoid = 'public.guard_profile_role_change()'::regprocedure
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'STOP: profiles.role compatibility surface was not restored';
  END IF;

  SELECT pg_catalog.regexp_replace(
           pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p.prosrc), '[[:space:]]+', '', 'g')),
           ';+$', '', 'g'
         )
  INTO v_handle_body
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = pg_catalog.to_regprocedure('public.handle_new_user()');
  IF NOT FOUND
     OR v_handle_body <> 'begininsertintopublic.profiles(id,full_name,role)values(new.id,coalesce(new.raw_user_meta_data->>''full_name'',new.email),''user'')onconflict(id)donothing;returnnew;end' THEN
    RAISE EXCEPTION 'STOP: handle_new_user() was not restored';
  END IF;

  SELECT pg_catalog.md5(pg_catalog.pg_get_functiondef('public.guard_profile_role_change()'::regprocedure))
  INTO v_guard_hash;
  IF v_guard_hash <> 'f407b466655fc0831eaac28f29007980' THEN
    RAISE EXCEPTION 'STOP: guard_profile_role_change() was not restored exactly';
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
    RAISE EXCEPTION 'STOP: public.is_owner() was not restored exactly';
  END IF;
  IF pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) ~* 'public[[:space:]]*\.[[:space:]]*profiles'
     OR pg_catalog.pg_get_functiondef('public.is_admin()'::regprocedure) !~* 'private[[:space:]]*\.[[:space:]]*admin_users' THEN
    RAISE EXCEPTION 'STOP: rollback changed the current private-based admin authority';
  END IF;
  IF (SELECT count(*) FROM private.admin_users) <> 1
     OR (SELECT count(*) FROM private.admin_users WHERE active) <> 1 THEN
    RAISE EXCEPTION 'STOP: private.admin_users changed during rollback';
  END IF;

  SELECT pg_catalog.md5(COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)
      ORDER BY p.schemaname, p.tablename, p.policyname)::text, '[]'))
  INTO v_policy_hash
  FROM pg_catalog.pg_policies AS p
  WHERE p.schemaname NOT IN ('pg_catalog', 'information_schema');
  IF v_policy_hash <> 'f612b3d190fd583eb90e79e052573529' THEN
    RAISE EXCEPTION 'STOP: live RLS policies changed during rollback';
  END IF;
END;
$rollback_postcheck$;

COMMIT;
