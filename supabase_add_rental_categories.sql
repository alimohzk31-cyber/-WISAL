-- Required once in the live database so services.category_id can reference
-- both new independent root categories. This is idempotent and does not alter
-- existing IDs, slugs, RLS policies, services, or category relationships.
begin;

insert into public.categories (slug, name_ar, name_en, icon, parent_id)
select 'car-rentals', 'تأجير سيارات', 'Car Rentals', 'CarFront', null
where not exists (
  select 1 from public.categories where slug = 'car-rentals'
);

insert into public.categories (slug, name_ar, name_en, icon, parent_id)
select 'crane-rentals', 'تأجير كرينات', 'Crane Rentals', 'Forklift', null
where not exists (
  select 1 from public.categories where slug = 'crane-rentals'
);

commit;
