-- ============================================================
-- Safe migration: add owner_id to public.services
-- Run in: Supabase Dashboard -> SQL Editor -> New Query
--
-- WHY: The app identifies the service owner with a device-generated
-- string (localStorage "saleen_owner_id", e.g. "owner_169..._ab12cd").
-- The existing "user_id" column is INTEGER and cannot store that value,
-- and there is no Supabase Auth in this app yet.
-- This column is added ONLY because it was verified as missing.
-- The app code auto-detects the column and starts using it immediately
-- after this migration runs (no code change needed).
--
-- This migration is IDEMPOTENT and does NOT touch any existing data,
-- tables, or policies.
-- ============================================================

-- 1. Add the column only if it does not exist
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS owner_id text;

-- 2. Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'owner_id';

-- ============================================================
-- NOTE ON RLS (no changes made):
-- RLS on public.services was verified empirically and currently
-- allows anonymous INSERT / SELECT / UPDATE / DELETE.
-- The app relies on this because it has no Supabase Auth yet.
-- If you later add Supabase Auth, tighten the policies, e.g.:
--
--   CREATE POLICY "services_insert_own" ON services
--     FOR INSERT WITH CHECK (auth.uid()::text = owner_id);
--   CREATE POLICY "services_update_own_or_admin" ON services
--     FOR UPDATE USING (auth.uid()::text = owner_id);
--   CREATE POLICY "services_delete_admin" ON services
--     FOR DELETE USING (<admin check>);
-- ============================================================