-- Keep customer lookups and foreign-key maintenance efficient as order volume grows.
create index if not exists drywall_takeoff_projects_customer_idx
  on public.drywall_takeoff_projects (customer_id);
