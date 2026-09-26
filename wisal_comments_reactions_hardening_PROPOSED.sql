-- WISAL SECURITY — PHASE 2C-3
-- PROPOSAL ONLY. DO NOT EXECUTE ON SUPABASE REMOTE.
--
-- Goal: bind new comment/reaction rows to the authenticated Supabase user.
-- Anonymous Sign-In users use the `authenticated` database role and have a
-- non-null auth.uid(), so this does not require a traditional account.
--
-- The owner_id columns are TEXT in the local schema. The explicit casts are
-- intentional and keep the proposal compatible if the remote column is also
-- text while comparing it to auth.uid() (uuid).
--
-- SELECT policies are intentionally untouched.
-- Existing UPDATE/DELETE policies are intentionally untouched.

-- --------------------------------------------------------------------------
-- public.service_comments
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS service_comments_insert_policy ON public.service_comments;
CREATE POLICY service_comments_insert_policy
ON public.service_comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id IS NOT NULL
  AND owner_id::text = auth.uid()::text
  AND length(trim(content)) > 0
);

-- --------------------------------------------------------------------------
-- public.service_reactions
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS service_reactions_insert_policy ON public.service_reactions;
CREATE POLICY service_reactions_insert_policy
ON public.service_reactions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id IS NOT NULL
  AND owner_id::text = auth.uid()::text
);

-- --------------------------------------------------------------------------
-- public.comments (legacy/general public comments wall)
-- This table remains publicly readable. Only its INSERT policy is proposed
-- here; its existing UPDATE/DELETE policies are not changed.
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS comments_insert_policy ON public.comments;
CREATE POLICY comments_insert_policy
ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND owner_id IS NOT NULL
  AND owner_id::text = auth.uid()::text
);

-- No SELECT, UPDATE, or DELETE policy is created or changed by this proposal.
