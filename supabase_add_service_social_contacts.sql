-- ============================================================
-- WISAL — إضافة أعمدة التواصل الاجتماعي إلى public.services
-- ------------------------------------------------------------
-- استقلالي وآمن:
--   • يضيف 4 أعمدة نصية فقط إذا لم تكن موجودة (IF NOT EXISTS).
--   • لا يحذف ولا يعدّل أي صف، ولا يلمس RLS، Policies، Grants،
--     Triggers، أو أي دالة / Edge Function.
--   • النتيجة: public.services يحتوي على
--       whatsapp_phone text
--       facebook_url   text
--       instagram_url  text
--       tiktok_url     text
--   • القيم الافتراضية NULL → لا يغيّر سلوك الخدمات الموجودة.
--
-- طريقة التشغيل: نسخ النص أدناه والصقه في Supabase SQL Editor
--   ثم تشغيله (Run). التغييرات تُطبّق فوراً ولا تحتاج migration.
-- ============================================================

alter table public.services
  add column if not exists whatsapp_phone text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text;
