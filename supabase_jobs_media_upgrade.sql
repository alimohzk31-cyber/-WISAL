-- Adds only the media columns required by the existing jobs feature.
-- No RLS policies, grants, existing rows, or approval logic are changed.
begin;

alter table public.jobs
  add column if not exists image_urls text[] not null default '{}',
  add column if not exists video_url text;

commit;
