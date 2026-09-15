-- ترقية محددة لحقول تفاصيل الوظائف فقط.
-- آمنة لإعادة التنفيذ، ولا تعدّل services أو سياساتها.
begin;

alter table public.jobs
  add column if not exists company_about text,
  add column if not exists requirements text,
  add column if not exists benefits text,
  add column if not exists address text,
  add column if not exists salary_negotiable boolean not null default false,
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists application_deadline date,
  add column if not exists training_duration text,
  add column if not exists training_paid boolean,
  add column if not exists training_hiring_possible boolean;

commit;
