-- ============================================================
-- Slider Manager Upgrade Migration
-- ============================================================
-- تعليمات التشغيل:
--   Supabase Dashboard → SQL Editor → New Query → الصق هذا الملف → Run
-- ============================================================
-- آمن تماماً: يستخدم ADD COLUMN IF NOT EXISTS
-- لن يفشل إذا كانت الأعمدة موجودة مسبقاً
-- لن يحذف أي بيانات موجودة
-- لن يلمس: services، categories، auth، admins، RLS
-- ============================================================

-- 1. Countdown
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS countdown_enabled      boolean    DEFAULT false;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS countdown_end_at       timestamptz DEFAULT null;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS countdown_expiry_action text        DEFAULT 'keep';
--   countdown_expiry_action values: 'keep' | 'hide' | 'show_ended'
--   timestamptz يضمن توحيد الوقت على جميع المناطق الزمنية

-- 2. CTA + Slide URL
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS enable_cta  boolean DEFAULT false;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS cta_text    text    DEFAULT null;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS cta_url     text    DEFAULT null;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS slide_url   text    DEFAULT null;

-- 3. Title / Description display controls
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS description      text    DEFAULT null;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS show_title       boolean DEFAULT true;
ALTER TABLE slider_images ADD COLUMN IF NOT EXISTS show_description boolean DEFAULT true;

-- ============================================================
-- تحقق: اعرض جميع أعمدة slider_images بعد التنفيذ
-- ============================================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'slider_images'
ORDER BY ordinal_position;
