-- WISAL SECURITY — PHASE 2B
-- Remote inspection only. Run manually in Supabase SQL Editor.
-- This file contains inspection queries only and makes no schema or data change.

-- 1) Public relations and row-level security state
SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  CASE c.relkind
    WHEN 'r' THEN 'table'
    WHEN 'p' THEN 'partitioned table'
    ELSE c.relkind::text
  END AS relation_type,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

-- 2) Actual policies on every public table.
-- command_code: r=read, a=append, w=change, d=remove, *=all
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command_code,
  qual AS using_expression,
  with_check AS with_check_expression,
  lower(regexp_replace(coalesce(qual, ''), '\s+', '', 'g')) IN ('true', '(true)') AS using_is_true,
  lower(regexp_replace(coalesce(with_check, ''), '\s+', '', 'g')) IN ('true', '(true)') AS with_check_is_true
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Policies on storage.objects.
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command_code,
  qual AS using_expression,
  with_check AS with_check_expression,
  lower(regexp_replace(coalesce(qual, ''), '\s+', '', 'g')) IN ('true', '(true)') AS using_is_true,
  lower(regexp_replace(coalesce(with_check, ''), '\s+', '', 'g')) IN ('true', '(true)') AS with_check_is_true
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- 4) All functions/RPCs in public, including security mode and definition.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_userbyid(p.proowner) AS owner_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode,
  coalesce(
    (SELECT string_agg(setting, ', ')
     FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS setting
     WHERE setting LIKE 'search_path=%'),
    '(database default)'
  ) AS search_path,
  p.proconfig AS function_settings,
  p.proacl AS raw_privileges,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, function_signature;

-- 5) Function permissions visible through information_schema.
SELECT
  routine_schema AS schema_name,
  routine_name AS function_name,
  specific_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
ORDER BY routine_name, specific_name, grantee;

-- 6) Function permissions from PostgreSQL ACLs, including implicit PUBLIC ACLs.
SELECT
  p.oid::regprocedure::text AS function_signature,
  coalesce(grantee.rolname, 'PUBLIC') AS grantee,
  acl.privilege_type,
  acl.is_grantable
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
LEFT JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) AS acl ON true
LEFT JOIN pg_roles AS grantee ON grantee.oid = acl.grantee
WHERE n.nspname = 'public'
ORDER BY function_signature, grantee, acl.privilege_type;

-- 7) Focused inspection of the owner-pending-service RPC.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.prosecdef AS is_security_definer,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_userbyid(p.proowner) AS owner_name,
  pg_get_functiondef(p.oid) AS full_definition,
  position('auth.uid()' IN lower(pg_get_functiondef(p.oid))) > 0 AS references_auth_uid,
  position('owner_id' IN lower(pg_get_functiondef(p.oid))) > 0 AS references_owner_id,
  position('p_owner_id' IN lower(pg_get_functiondef(p.oid))) > 0 AS accepts_owner_id_argument,
  EXISTS (
    SELECT 1
    FROM information_schema.routine_privileges AS rp
    WHERE rp.routine_schema = 'public'
      AND rp.routine_name = p.proname
      AND rp.grantee = 'anon'
      AND rp.privilege_type = 'EXECUTE'
  ) AS anon_can_execute_by_name
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_own_pending_service_id'
ORDER BY function_signature;

-- 8) Storage buckets and their effective public/private flag.
SELECT
  id AS bucket_id,
  name AS bucket_name,
  public AS is_public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY id;

-- 9) Table permissions for the two client roles on public tables.
SELECT
  table_schema AS schema_name,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 10) Permissions on storage relations for the two client roles.
SELECT
  table_schema AS schema_name,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'storage'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 11) Focused table permission view for sensitive WISAL relations.
SELECT
  table_schema AS schema_name,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'services', 'jobs', 'comments', 'reactions', 'service_comments',
    'service_reactions', 'contact_messages', 'admin_notifications',
    'job_applications', 'profiles'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 12) Roles used by the client and administrator checks.
SELECT
  rolname,
  rolsuper,
  rolbypassrls,
  rolcanlogin,
  rolcreaterole,
  rolcreatedb
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY rolname;

-- 13) Admin-sensitive function summary for quick review.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode,
  pg_get_userbyid(p.proowner) AS owner_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname = 'is_admin'
    OR p.proname LIKE 'admin\_%' ESCAPE '\'
    OR p.proname IN (
      'request_is_admin', 'require_admin', 'get_own_pending_service_id',
      'increment_visits', 'increment_service_views'
    )
  )
ORDER BY p.proname, function_signature;

-- 14) Admin-sensitive function permissions for anon/authenticated.
SELECT
  routine_schema AS schema_name,
  routine_name AS function_name,
  specific_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
  AND (
    routine_name = 'is_admin'
    OR routine_name LIKE 'admin\_%' ESCAPE '\'
    OR routine_name IN (
      'request_is_admin', 'require_admin', 'get_own_pending_service_id',
      'increment_visits', 'increment_service_views'
    )
  )
ORDER BY routine_name, specific_name, grantee;

-- 15) Explicit list of client RPC names observed in the WISAL frontend.
SELECT
  p.oid::regprocedure::text AS function_signature,
  p.proname AS function_name,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_admin', 'admin_list_services', 'admin_set_service_status',
    'admin_update_service', 'admin_delete_service',
    'admin_list_contact_messages', 'admin_set_contact_message_status',
    'admin_delete_contact_message', 'get_own_pending_service_id',
    'increment_visits', 'increment_service_views'
  )
ORDER BY p.proname, function_signature;
