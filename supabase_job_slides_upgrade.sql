-- ============================================================================
-- ترقية آمنة لقسم "إدارة الوظائف > السلايدر" (جدول job_slides)
-- ============================================================================
-- طريقة التشغيل:  Supabase Dashboard → SQL Editor → New Query → الصق الملف → Run
-- ----------------------------------------------------------------------------
-- هذا الملف آمن تماماً:
--   * يضيف أعمدة جديدة فقط (ADD COLUMN IF NOT EXISTS)
--   * لا يحذف ولا يعدّل أي بيانات موجودة
--   * لا يلمس: jobs، job_categories، auth، RLS الموجودة
--   * كل الأعمدة الجديدة بقيم افتراضية آمنة، فتظهر السلايدات القديمة كما هي.
-- ----------------------------------------------------------------------------
-- ملاحظة: هذا التصميم يستبدل نظام "تاريخ البداية/النهاية" بنظام
-- "مدة تشغيل السلايدر" (ساعة : دقيقة : ثانية) مع عدّ تنازلي حقيقي.
-- عمودا starts_at / ends_at إن كانا أُضيفا من نسخة سابقة يُتركان دون استخدام
-- (لا نحذف أي بيانات). النظام يعمل أيضاً قبل تنفيذ هذا الملف عبر طبقة محلية.
-- ============================================================================

begin;

-- ============================================================================
-- 1) زر الشريحة والرابط
-- ============================================================================
alter table public.job_slides add column if not exists button_text text;

-- نوع الرابط: internal | job | jobs_section | external | none
alter table public.job_slides add column if not exists link_type  text not null default 'internal';
alter table public.job_slides add column if not exists link_value text;

-- الرابط النهائي المحسوب (يبقى للتوافق مع النسخ القديمة)
alter table public.job_slides add column if not exists button_link text;

-- ============================================================================
-- 2) مدة تشغيل السلايدر (بدلاً من نظام التاريخ)
--    run_mode: always (تشغيل دائم) | timed (تشغيل لمدة)
--    run_started_at / run_ends_at: تُحفظ أوقات البداية والنهاية الحقيقية
--    حتى يستمر العد التنازلي صحيحاً بعد تحديث الصفحة أو فتح لوحة الإدارة مجدداً
-- ============================================================================
alter table public.job_slides add column if not exists run_mode          text        not null default 'always'; -- always | timed
alter table public.job_slides add column if not exists duration_hours   integer     not null default 0 check (duration_hours between 0 and 23);
alter table public.job_slides add column if not exists duration_minutes integer     not null default 0 check (duration_minutes between 0 and 59);
alter table public.job_slides add column if not exists duration_seconds integer     not null default 0 check (duration_seconds between 0 and 59);
alter table public.job_slides add column if not exists run_started_at   timestamptz;
alter table public.job_slides add column if not exists run_ends_at      timestamptz;

-- ============================================================================
-- 3) التصميم (تخصيص المظهر)
-- ============================================================================
alter table public.job_slides add column if not exists text_position      text    not null default 'center'; -- right | center | left
alter table public.job_slides add column if not exists text_vertical      text    not null default 'middle'; -- top | middle | bottom
alter table public.job_slides add column if not exists title_size         text    not null default 'medium'; -- small | medium | large
alter table public.job_slides add column if not exists subtitle_size      text    not null default 'medium'; -- small | medium | large
alter table public.job_slides add column if not exists text_color         text    not null default '#FFFFFF';
alter table public.job_slides add column if not exists button_color       text    not null default '#7C3AED';
alter table public.job_slides add column if not exists button_text_color  text    not null default '#FFFFFF';
alter table public.job_slides add column if not exists overlay_enabled    boolean not null default true;
alter table public.job_slides add column if not exists overlay_opacity    numeric not null default 0.45; -- 0 .. 0.9
alter table public.job_slides add column if not exists image_fit          text    not null default 'cover'; -- cover | contain
alter table public.job_slides add column if not exists show_dots          boolean not null default true;
alter table public.job_slides add column if not exists show_title         boolean not null default true;
alter table public.job_slides add column if not exists show_description   boolean not null default true;
alter table public.job_slides add column if not exists show_button        boolean not null default true;

-- ============================================================================
-- 4) جدول إعدادات السلايدر ككل (صف واحد فقط)
-- ============================================================================
create table if not exists public.job_slider_settings (
  id               integer primary key default 1 check (id = 1),
  autoplay         boolean not null default true,
  duration_seconds integer not null default 5 check (duration_seconds between 3 and 10),
  loop_enabled     boolean not null default true,
  touch_drag       boolean not null default true,
  mobile_height    text    not null default 'medium' check (mobile_height in ('short','medium','tall')),
  corner_radius    text    not null default 'medium' check (corner_radius in ('soft','medium','rounded')),
  updated_at       timestamptz not null default now()
);

-- تهيئة الصف الوحيد بالإعدادات الافتراضية (لا يُكرَّر عند وجوده)
insert into public.job_slider_settings (id)
values (1)
on conflict (id) do nothing;

-- ============================================================================
-- 5) أمان الصفوف (RLS) — نفس نمط job_slides الموجودة
-- ============================================================================
alter table public.job_slider_settings enable row level security;

drop policy if exists job_slider_settings_public_read on public.job_slider_settings;
create policy job_slider_settings_public_read on public.job_slider_settings
  for select to anon, authenticated using (true);

drop policy if exists job_slider_settings_admin_write on public.job_slider_settings;
create policy job_slider_settings_admin_write on public.job_slider_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.job_slider_settings to anon, authenticated;
grant insert, update, delete on public.job_slider_settings to authenticated;

-- ============================================================================
-- 6) Realtime — حتى يتحدث سلايدر الوظائف فورياً عند تعديل الإعدادات
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_slider_settings') then
      alter publication supabase_realtime add table public.job_slider_settings;
    end if;
  end if;
end $$;

commit;

-- ============================================================================
-- 7) تحقق: اعرض أعمدة job_slides بعد التنفيذ
-- ============================================================================
-- select column_name, data_type, column_default, is_nullable
-- from information_schema.columns
-- where table_name = 'job_slides'
-- order by ordinal_position;

alter table public.job_slides add column if not exists corner_radius      text    not null default 'medium'; -- soft | medium | rounded
