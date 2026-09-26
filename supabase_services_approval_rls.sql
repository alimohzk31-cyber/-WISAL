-- ============================================================
-- Saleen Services: موافقة الإدارة + تحصين RLS
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run
--
-- آمن: idempotent (IF NOT EXISTS / OR REPLACE)، لا يحذف بيانات،
-- لا يعيد تسمية جداول/أعمدة، لا يلمس categories أو slider_images أو stats.
-- لا يُغيّر أي عمود أو API قائم في الكود.
--
-- النتيجة الأمنية بعد التنفيذ:
--   1) أي خدمة pending/rejected لا تُرجع للعامة إطلاقاً عبر API مباشرة.
--   2) المستثنى الوحيد: طلب يحمل x-owner-id = owner_id (صاحب الخدمة)
--      أو x-admin-mode = 1 (لوحة الإدارة).
--   3) لا يمكن إدراج خدمة بحالة approved مباشرة (الإدراج pending إجبارياً).
--   4) لا يمكن تغيير status إلى approved بدون x-admin-mode = 1
--      (حتى صاحب الخدمة لا يستطيع الموافقة على خدمته بنفسه).
--   5) الحذف: للمدير أو مالك الخدمة فقط.
--
-- توقيع الهيدرات مع PostgREST: يقرأها السيرفر من
--   current_setting('request.headers', true)::json
-- (المفاتيح كلها lower-case).
-- ============================================================

-- 1) عمود owner_id المطلوب لربط الخدمة بمنشئها (غير موجود حالياً في القاعدة الحية)
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS owner_id text;

-- 2) دوال مساعدة تقرأ هيدرات الطلب (STABLE، آمنة للاستدعاء داخل RLS)
CREATE OR REPLACE FUNCTION public.request_owner_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-owner-id', '');
$$;

CREATE OR REPLACE FUNCTION public.request_is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.headers', true), '')::json ->> 'x-admin-mode' = '1';
$$;

-- 3) تفعيل RLS (مفعّل مسبقاً لكن التأكيد لا يضر)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 4) SELECT: approved للجميع؛ pending/rejected لصاحبها فقط أو للمدير
DROP POLICY IF EXISTS "services_select_policy" ON public.services;
CREATE POLICY "services_select_policy" ON public.services
  FOR SELECT
  USING (
    status = 'approved'
    OR public.request_owner_id() = owner_id
    OR public.request_is_admin()
  );

-- 5) INSERT: أي خدمة جديدة تبدأ pending حصراً (لا يمكن تجاوز الموافقة بالإدراج المباشر)
DROP POLICY IF EXISTS "services_insert_policy" ON public.services;
CREATE POLICY "services_insert_policy" ON public.services
  FOR INSERT
  WITH CHECK (status = 'pending');

-- 6) UPDATE: من يستطيع التحديث ماذا
--    - USING: مثل رؤية SELECT (approved للجميع + صاحبها + المدير)
--    - WITH CHECK: تغيير الحالة = صلاحية المدير فقط؛
--      صاحب الخدمة يعدّل خدمته المعلقة/المرفوضة دون تغيير حالتها.
DROP POLICY IF EXISTS "services_update_policy" ON public.services;
CREATE POLICY "services_update_policy" ON public.services
  FOR UPDATE
  USING (
    status = 'approved'
    OR public.request_owner_id() = owner_id
    OR public.request_is_admin()
  )
  WITH CHECK (
    public.request_is_admin()
    OR (public.request_owner_id() = owner_id AND status IN ('pending', 'rejected'))
  );

-- 7) DELETE: المدير أو مالك الخدمة فقط
DROP POLICY IF EXISTS "services_delete_policy" ON public.services;
CREATE POLICY "services_delete_policy" ON public.services
  FOR DELETE
  USING (
    public.request_is_admin()
    OR public.request_owner_id() = owner_id
  );

-- ============================================================
-- تحقق اختياري:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'services';
-- ============================================================
-- LEGACY / DO NOT APPLY TO PRODUCTION
-- Historical compatibility migration. Do not run automatically; use only the
-- reviewed security migrations for the current database.
