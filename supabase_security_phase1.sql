-- ============================================================================
-- SALEEN SERVICE — SECURITY HARDENING PHASE 1
-- (AUTH + RLS + ROLES + ADMIN SECURITY + OWNER SECURITY)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY:
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--   (or run locally: node scripts/_apply_migration.mjs)
--
-- SAFE & IDEMPOTENT: uses IF NOT EXISTS / DROP IF EXISTS / OR REPLACE.
--   * Never deletes any row.
--   * services table is CURRENTLY EMPTY (verified live), so converting
--     owner_id text -> uuid is data-safe; legacy rows with non-uuid values
--     are set to NULL (never guessed).
--   * comments keep their legacy text owner_id untouched; a NEW owner_uid
--     (uuid) column is used for the new security model.
--
-- THE GOAL:
--   Identity comes ONLY from auth.uid() — never from client headers.
--   Admin role is stored in public.profiles (NOT in the frontend).
--   Any policy relying on request.headers / x-owner-id / x-admin-mode
--   is dropped and re-created using auth.uid() and public.is_admin().
-- ============================================================================

-- ============================================================================
-- 0) DROP OLD HEADER-BASED POLICIES & FUNCTIONS
--    (must drop policies first because functions below are referenced by them)
-- ============================================================================
DROP POLICY IF EXISTS "services_select_policy"   ON public.services;
DROP POLICY IF EXISTS "services_insert_policy"   ON public.services;
DROP POLICY IF EXISTS "services_update_policy"   ON public.services;
DROP POLICY IF EXISTS "services_delete_policy"   ON public.services;

DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

DROP POLICY IF EXISTS "slider_images_select_policy" ON public.slider_images;
DROP POLICY IF EXISTS "slider_images_insert_policy" ON public.slider_images;
DROP POLICY IF EXISTS "slider_images_update_policy" ON public.slider_images;
DROP POLICY IF EXISTS "slider_images_delete_policy" ON public.slider_images;

DROP POLICY IF EXISTS "comments_select_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_update_policy" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_policy" ON public.comments;

DROP POLICY IF EXISTS "contact_messages_select_policy" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_insert_policy" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_update_policy" ON public.contact_messages;
DROP POLICY IF EXISTS "contact_messages_delete_policy" ON public.contact_messages;

-- Header-based "identity proof" helpers — removed, they are forgeable.
DROP FUNCTION IF EXISTS public.request_owner_id();
DROP FUNCTION IF EXISTS public.request_is_admin();

-- ============================================================================
-- 1) PROFILES (roles stored server-side, never in the frontend)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  text,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user','owner','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Admin bootstrap: the very first registered user becomes admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role text := 'user';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2) is_admin() helper (server-side role check used by RLS and by the app)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), '') = 'admin';
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ============================================================================
-- 3) services.owner_id -> uuid (table is empty; legacy non-uuid values -> NULL)
-- ============================================================================
ALTER TABLE public.services ALTER COLUMN owner_id DROP DEFAULT;

UPDATE public.services
   SET owner_id = NULL
 WHERE owner_id IS NOT NULL
   AND owner_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

ALTER TABLE public.services ALTER COLUMN owner_id TYPE uuid USING owner_id::uuid;

-- Force ownership on every INSERT: services.owner_id = auth.uid(), always.
CREATE OR REPLACE FUNCTION public.set_service_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.owner_id := auth.uid();
  new.status   := COALESCE(new.status, 'pending');
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_service_owner ON public.services;
CREATE TRIGGER trg_set_service_owner
  BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_service_owner();

-- ============================================================================
-- 4) comments: add uuid-linking column + ownership triggers
--    (legacy text owner_id is left untouched)
-- ============================================================================
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS owner_uid uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.set_comment_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.owner_uid := auth.uid();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_comment_owner ON public.comments;
CREATE TRIGGER trg_set_comment_owner
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_comment_owner();

-- Nobody can rewrite who owns an existing comment.
CREATE OR REPLACE FUNCTION public.protect_comment_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF new.owner_uid IS DISTINCT FROM old.owner_uid THEN
    RAISE EXCEPTION 'cannot change comment owner';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_comment_owner ON public.comments;
CREATE TRIGGER trg_protect_comment_owner
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.protect_comment_owner();

-- ============================================================================
-- 5) contact_messages (does not exist yet in the live DB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id           bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  message_type text    NOT NULL DEFAULT 'other',
  message      text    NOT NULL DEFAULT '',
  image_url    text,
  owner_uid    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status       text    NOT NULL DEFAULT 'new',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages (created_at DESC);

CREATE OR REPLACE FUNCTION public.set_contact_message_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  new.owner_uid := auth.uid();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_contact_message_owner ON public.contact_messages;
CREATE TRIGGER trg_set_contact_message_owner
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_contact_message_owner();

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6) REAL RLS POLICIES (auth.uid() based)
-- ============================================================================

-- ---------- profiles ----------
CREATE POLICY "profiles_select_own"    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin"  ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "profiles_insert_own"    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
-- A regular user may edit their own row, but can never promote themselves.
CREATE POLICY "profiles_update_own"    ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "profiles_update_admin"  ON public.profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "profiles_delete_admin"  ON public.profiles FOR DELETE USING (public.is_admin());

-- ---------- services ----------
CREATE POLICY "services_select_policy" ON public.services FOR SELECT
  USING (status = 'approved' OR owner_id = auth.uid() OR public.is_admin());

-- Only logged-in users can add; must start as pending (no self-approval).
CREATE POLICY "services_insert_policy" ON public.services FOR INSERT
  WITH CHECK (status = 'pending' AND auth.uid() IS NOT NULL);

-- Owner edits own pending/rejected (cannot self-approve); admin edits everything.
CREATE POLICY "services_update_policy" ON public.services FOR UPDATE
  USING (owner_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    public.is_admin()
    OR (owner_id = auth.uid() AND status IN ('pending','rejected'))
  );

CREATE POLICY "services_delete_policy" ON public.services FOR DELETE
  USING (owner_id = auth.uid() OR public.is_admin());

-- ---------- categories ----------
CREATE POLICY "categories_select_policy" ON public.categories FOR SELECT USING (true);
CREATE POLICY "categories_insert_policy" ON public.categories FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "categories_update_policy" ON public.categories FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "categories_delete_policy" ON public.categories FOR DELETE
  USING (public.is_admin());

-- ---------- slider_images ----------
CREATE POLICY "slider_images_select_policy" ON public.slider_images FOR SELECT USING (true);
CREATE POLICY "slider_images_insert_policy" ON public.slider_images FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "slider_images_update_policy" ON public.slider_images FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "slider_images_delete_policy" ON public.slider_images FOR DELETE
  USING (public.is_admin());

-- ---------- comments ----------
CREATE POLICY "comments_select_policy" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_policy" ON public.comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "comments_update_policy" ON public.comments FOR UPDATE
  USING (owner_uid = auth.uid() OR public.is_admin())
  WITH CHECK (owner_uid = auth.uid() OR public.is_admin());
CREATE POLICY "comments_delete_policy" ON public.comments FOR DELETE
  USING (owner_uid = auth.uid() OR public.is_admin());

-- ---------- contact_messages (admin reads/manages; any auth user submits) ----------
CREATE POLICY "contact_messages_select_policy" ON public.contact_messages FOR SELECT
  USING (public.is_admin());
CREATE POLICY "contact_messages_insert_policy" ON public.contact_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "contact_messages_update_policy" ON public.contact_messages FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "contact_messages_delete_policy" ON public.contact_messages FOR DELETE
  USING (public.is_admin());

-- ============================================================================
-- 7) STORAGE: slider-images bucket writes become admin-only (read stays public).
--    No assumptions: everything below only runs if the bucket exists.
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'slider-images') THEN
    DROP POLICY IF EXISTS "slider_images_public_insert" ON storage.objects;
    DROP POLICY IF EXISTS "slider_images_public_delete" ON storage.objects;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='storage' AND tablename='objects'
                     AND policyname='slider_images_admin_insert') THEN
      CREATE POLICY "slider_images_admin_insert" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'slider-images' AND public.is_admin());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='storage' AND tablename='objects'
                     AND policyname='slider_images_admin_delete') THEN
      CREATE POLICY "slider_images_admin_delete" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'slider-images' AND public.is_admin());
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 8) VERIFY (read-only, run anytime)
-- ============================================================================
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;
--
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='services'
--   AND column_name IN ('owner_id','status') ORDER BY ordinal_position;
-- ============================================================================