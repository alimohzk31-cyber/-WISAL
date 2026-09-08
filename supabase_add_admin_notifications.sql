-- Isolated notification storage. Run once in Supabase SQL Editor.
-- Requires the existing public.is_admin() helper and an authenticated admin.
-- Does not change services, profiles, existing policies, or existing RPCs.
BEGIN;

CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  message text NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz DEFAULT NULL
);

CREATE INDEX admin_notifications_published_idx
  ON public.admin_notifications (published_at DESC, id DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_notifications FROM anon, authenticated;
GRANT SELECT ON public.admin_notifications TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_notifications TO authenticated;

CREATE POLICY notifications_read_published ON public.admin_notifications
  FOR SELECT TO anon, authenticated USING (published_at IS NOT NULL);
CREATE POLICY notifications_admin_read ON public.admin_notifications
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY notifications_admin_create ON public.admin_notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY notifications_admin_update ON public.admin_notifications
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY notifications_admin_delete ON public.admin_notifications
  FOR DELETE TO authenticated USING (public.is_admin());

COMMIT;
