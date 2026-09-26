-- WISAL SECURITY — PHASE 2C-1
-- Pending-service RPC hardening only.
-- PROPOSAL ONLY: do not execute automatically. No Remote SQL was executed.
--
-- The function signature is intentionally preserved for PostgREST/frontend
-- compatibility. p_owner_id remains an accepted argument but is ignored.
-- The only ownership value used by the query is auth.uid().

CREATE OR REPLACE FUNCTION public.get_own_pending_service_id(
  p_slug text,
  p_owner_id text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id
  FROM public.services AS s
  WHERE s.slug = p_slug
    AND s.status = 'pending'
    AND auth.uid() IS NOT NULL
    AND s.owner_id::text = auth.uid()::text
  LIMIT 1;
$$;

-- SECURITY DEFINER is retained because the pending row is intentionally hidden
-- by the normal SELECT policy. The function returns only the caller's own id.
-- PUBLIC is revoked as well as anon: PUBLIC would otherwise include anon.
REVOKE EXECUTE ON FUNCTION public.get_own_pending_service_id(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_pending_service_id(text, text) TO authenticated;
