-- Additive profile and post ownership support for the WISAL user profile.
-- This migration extends the existing profiles/jobs tables; it creates no
-- parallel account/profile table and does not remove existing data.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profession text,
  ADD COLUMN IF NOT EXISTS governorate text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS portfolio_images text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS owner_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Every job submitted by an authenticated user, including an existing
-- Supabase anonymous session, is tied to that session. Client supplied IDs
-- cannot assign a post to another account.
CREATE OR REPLACE FUNCTION public.set_job_owner_uid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.owner_uid := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_job_owner_uid ON public.jobs;
CREATE TRIGGER trg_set_job_owner_uid
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_job_owner_uid();

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'jobs'
      AND policyname = 'jobs_owner_read_own'
  ) THEN
    CREATE POLICY jobs_owner_read_own ON public.jobs
      FOR SELECT TO authenticated USING (owner_uid = auth.uid());
  END IF;
END;
$$;
GRANT SELECT ON public.jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Anonymous Supabase sessions are used for the existing no-login public
-- experience. They must never consume the legacy first-user admin bootstrap.
-- The first non-anonymous account still receives the existing bootstrap role
-- when the project has no administrator yet.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role text := 'user';
BEGIN
  IF NOT COALESCE(new.is_anonymous, false)
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN
    new_role := 'admin';
  END IF;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

COMMIT;
