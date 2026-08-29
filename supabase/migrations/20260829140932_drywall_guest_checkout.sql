-- Passwordless, fixed-price drywall takeoff checkout for Spain.
-- All customer access is mediated by server routes; no browser role receives
-- direct table access. Source files and deliverables remain in private buckets.

create table public.drywall_takeoff_customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null unique,
  company text,
  created_at timestamptz not null default now()
);

create unique index drywall_takeoff_customers_email_unique
  on public.drywall_takeoff_customers (lower(email));

create table public.drywall_takeoff_projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.drywall_takeoff_customers(id),
  draft_token_hash text not null unique,
  project_name text not null,
  location text not null,
  project_type text not null,
  desired_bid_date date,
  customer_notes text,
  scope_answers jsonb not null default '{}'::jsonb,
  selected_pages jsonb not null default '[]'::jsonb,
  selected_sheet_count integer not null default 0
    check (selected_sheet_count between 0 and 500),
  status text not null default 'upload_incomplete' check (status in (
    'upload_incomplete', 'awaiting_payment', 'custom_review', 'order_received',
    'initial_review', 'takeoff_in_progress', 'quality_review', 'delivered',
    'revision_requested', 'revised', 'completed', 'refunded', 'cancelled'
  )),
  measurement_policy_version text not null default 'PLADUR-ES-1.0',
  marketing_attribution jsonb not null default '{}'::jsonb,
  session_identifier text,
  due_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  reviewer_name text,
  qa_checks jsonb not null default '{}'::jsonb,
  assumptions_confirmed boolean not null default false,
  legal_hold boolean not null default false,
  retention_delete_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drywall_takeoff_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.drywall_takeoff_projects(id) on delete cascade,
  bucket text not null default 'drywall-customer-files',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 5 and 524288000),
  client_sha256 text,
  verified_sha256 text,
  page_count integer check (page_count between 1 and 500),
  upload_status text not null default 'pending' check (
    upload_status in ('pending', 'uploaded', 'verified', 'rejected')
  ),
  rejection_reason text,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create table public.drywall_takeoff_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.drywall_takeoff_projects(id) on delete cascade,
  order_number text not null unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  amount_subtotal_cents integer not null default 14900 check (amount_subtotal_cents = 14900),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  amount_total_cents integer not null default 14900 check (amount_total_cents >= 14900),
  currency text not null default 'eur' check (currency = 'eur'),
  payment_status text not null default 'unpaid' check (
    payment_status in ('unpaid', 'checkout_created', 'paid', 'failed', 'refunded')
  ),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.drywall_takeoff_deliverables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.drywall_takeoff_projects(id) on delete cascade,
  version integer not null check (version > 0),
  file_type text not null check (file_type in ('marked_pdf', 'quantity_workbook')),
  bucket text not null default 'drywall-deliverables',
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, version, file_type)
);

create table public.drywall_takeoff_events (
  id bigint generated always as identity primary key,
  project_id uuid references public.drywall_takeoff_projects(id) on delete cascade,
  event_name text not null,
  actor text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.drywall_takeoff_revision_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.drywall_takeoff_projects(id) on delete cascade,
  delivery_version integer not null check (delivery_version > 0),
  category text not null check (category in (
    'incorrect_quantity', 'missing_area', 'classification', 'opening',
    'assumption', 'file', 'other'
  )),
  drawing_page text not null,
  area text not null,
  measurement_id text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index drywall_takeoff_one_open_revision_idx
  on public.drywall_takeoff_revision_requests (project_id)
  where status = 'open';

create index drywall_takeoff_projects_status_created_idx
  on public.drywall_takeoff_projects (status, created_at desc);
create index drywall_takeoff_files_project_idx
  on public.drywall_takeoff_files (project_id, created_at);
create index drywall_takeoff_events_project_idx
  on public.drywall_takeoff_events (project_id, created_at desc);

create trigger drywall_takeoff_projects_updated_at
before update on public.drywall_takeoff_projects
for each row execute function public.set_updated_at();

create trigger drywall_takeoff_orders_updated_at
before update on public.drywall_takeoff_orders
for each row execute function public.set_updated_at();

alter table public.drywall_takeoff_customers enable row level security;
alter table public.drywall_takeoff_projects enable row level security;
alter table public.drywall_takeoff_files enable row level security;
alter table public.drywall_takeoff_orders enable row level security;
alter table public.drywall_takeoff_deliverables enable row level security;
alter table public.drywall_takeoff_events enable row level security;
alter table public.drywall_takeoff_revision_requests enable row level security;

revoke all on table public.drywall_takeoff_customers from anon, authenticated;
revoke all on table public.drywall_takeoff_projects from anon, authenticated;
revoke all on table public.drywall_takeoff_files from anon, authenticated;
revoke all on table public.drywall_takeoff_orders from anon, authenticated;
revoke all on table public.drywall_takeoff_deliverables from anon, authenticated;
revoke all on table public.drywall_takeoff_events from anon, authenticated;
revoke all on table public.drywall_takeoff_revision_requests from anon, authenticated;

grant all on table public.drywall_takeoff_customers to service_role;
grant all on table public.drywall_takeoff_projects to service_role;
grant all on table public.drywall_takeoff_files to service_role;
grant all on table public.drywall_takeoff_orders to service_role;
grant all on table public.drywall_takeoff_deliverables to service_role;
grant all on table public.drywall_takeoff_events to service_role;
grant all on table public.drywall_takeoff_revision_requests to service_role;
grant usage, select on sequence public.drywall_takeoff_events_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('drywall-customer-files', 'drywall-customer-files', false, 524288000, array['application/pdf']),
  ('drywall-deliverables', 'drywall-deliverables', false, 524288000, array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on table public.drywall_takeoff_projects is
  'Fixed-price passwordless Spanish drywall takeoff projects.';
comment on table public.drywall_takeoff_deliverables is
  'Versioned reviewed PDF and XLSX customer deliverables.';
