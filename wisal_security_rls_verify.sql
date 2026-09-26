-- WISAL SECURITY — PHASE 2C RLS VERIFICATION
-- READ-ONLY. This file only reports whether the requested relations exist,
-- whether row-level security is enabled, and whether it is forced.

WITH requested AS (
  SELECT 'services'::text AS table_name
  UNION ALL SELECT 'jobs'
  UNION ALL SELECT 'contact_messages'
  UNION ALL SELECT 'comments'
  UNION ALL SELECT 'service_comments'
  UNION ALL SELECT 'service_reactions'
  UNION ALL SELECT 'admin_notifications'
  UNION ALL SELECT 'profiles'
)
SELECT
  'public'::text AS schema_name,
  requested.table_name,
  (c.oid IS NOT NULL) AS table_exists,
  coalesce(c.relrowsecurity, false) AS relrowsecurity,
  coalesce(c.relforcerowsecurity, false) AS relforcerowsecurity,
  CASE
    WHEN c.oid IS NULL THEN 'missing'
    WHEN c.relrowsecurity AND c.relforcerowsecurity THEN 'enabled_and_forced'
    WHEN c.relrowsecurity THEN 'enabled_not_forced'
    ELSE 'disabled'
  END AS rls_state
FROM requested
LEFT JOIN pg_namespace AS n
  ON n.nspname = 'public'
LEFT JOIN pg_class AS c
  ON c.relname = requested.table_name
 AND c.relnamespace = n.oid
ORDER BY requested.table_name;
