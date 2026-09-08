-- ============================================================
-- ترقية اختيارية لجدول slider_images — إعدادات تصميم الشريحة
-- نفّذ هذا السكربت مرة واحدة في Supabase SQL Editor.
-- بدون التنفيذ يعمل النظام أيضاً (تُحفظ القيم في طبقة محلية مؤقتاً)،
-- وبعد التنفيذ تُحفظ في قاعدة البيانات لجميع الأجهزة.
-- لا يُحذف أو يُعدَّل أي صف موجود — أعمدة جديدة فقط بقيم افتراضية آمنة.
-- ============================================================

alter table public.slider_images add column if not exists subtitle text;
alter table public.slider_images add column if not exists button_text text;
alter table public.slider_images add column if not exists button_link text;
alter table public.slider_images add column if not exists duration_seconds integer default 5;
alter table public.slider_images add column if not exists language text default 'ar';
alter table public.slider_images add column if not exists font_family text default 'Cairo';
alter table public.slider_images add column if not exists font_size integer default 28;
alter table public.slider_images add column if not exists text_color text default '#FFFFFF';
alter table public.slider_images add column if not exists button_color text default '#7C3AED';

-- تعبئة أي صفوف قديمة بقيمة المدة الافتراضية (5 ثوانٍ) دون تغيير أي شيء آخر
update public.slider_images set duration_seconds = 5 where duration_seconds is null;

-- قيد مدة العرض (2..60) — لا يؤثر على الصفوف الحالية لأنها أصبحت كلها ضمن النطاق
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'slider_images_duration_range'
  ) then
    alter table public.slider_images
      add constraint slider_images_duration_range check (duration_seconds between 2 and 60);
  end if;
end $$;
