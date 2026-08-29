alter table public.drywall_takeoff_projects
  add column if not exists locale text not null default 'es'
  check (locale in ('es', 'en'));

comment on column public.drywall_takeoff_projects.locale is
  'Customer-facing language for Checkout, portal and transactional email.';
