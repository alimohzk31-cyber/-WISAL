-- شغّل هذا الملف يدويًا في Supabase SQL Editor قبل حفظ روابط التواصل.
-- لا يغيّر RLS ولا السياسات ولا الدوال الحالية.
begin;

alter table public.services
  add column if not exists whatsapp_phone text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text;

commit;
