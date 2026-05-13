create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'usd',
  stripe_price_id text,
  included_views integer not null check (included_views >= 1),
  revision_rounds integer not null default 0 check (revision_rounds >= 0),
  estimated_delivery_days_min integer not null check (estimated_delivery_days_min >= 1),
  estimated_delivery_days_max integer not null check (estimated_delivery_days_max >= estimated_delivery_days_min),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  order_number text not null unique,
  customer_name text,
  customer_email text not null,
  package_id uuid references public.packages(id),
  status text not null default 'draft' check (
    status in (
      'draft',
      'awaiting_payment',
      'paid_pending_processing',
      'processing',
      'needs_review',
      'completed',
      'cancelled',
      'refunded',
      'failed'
    )
  ),
  render_type text,
  project_type text,
  style_preference text,
  number_of_floors integer,
  estimated_square_meters numeric,
  customer_notes text,
  deadline_preference text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_cents integer,
  currency text,
  paid_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  internal_notes text,
  assigned_worker_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  bucket text not null,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  size_bytes bigint,
  file_role text not null default 'customer_upload' check (
    file_role in ('customer_upload', 'final_render', 'reference', 'admin_upload')
  ),
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null,
  amount_cents integer,
  currency text,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  logs text,
  created_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  email_type text not null,
  recipient text not null,
  provider_message_id text,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists packages_active_sort_idx on public.packages(active, sort_order);
create index if not exists orders_package_id_idx on public.orders(package_id);
create index if not exists orders_status_created_idx on public.orders(status, created_at);
create index if not exists orders_customer_email_idx on public.orders(lower(customer_email));
create index if not exists orders_assigned_worker_id_idx on public.orders(assigned_worker_id);
create index if not exists order_files_order_id_idx on public.order_files(order_id);
create index if not exists payments_order_id_idx on public.payments(order_id);
create unique index if not exists payments_checkout_session_unique_idx
  on public.payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
create unique index if not exists payments_payment_intent_unique_idx
  on public.payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
create index if not exists worker_runs_order_id_idx on public.worker_runs(order_id);
create index if not exists email_events_order_id_idx on public.email_events(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists packages_set_updated_at on public.packages;
create trigger packages_set_updated_at
before update on public.packages
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.packages (
  slug,
  name,
  description,
  price_cents,
  currency,
  stripe_price_id,
  included_views,
  revision_rounds,
  estimated_delivery_days_min,
  estimated_delivery_days_max,
  active,
  sort_order
)
values
  ('basic-render', 'Basic Render', 'One clear, polished view to validate your idea quickly.', 14900, 'usd', null, 1, 0, 3, 5, true, 1),
  ('pro-render', 'Pro Render', 'The most balanced option for presenting your project with more detail.', 29900, 'usd', null, 2, 2, 3, 5, true, 2),
  ('premium-render-pack', 'Premium Render Pack', 'Four views ready for presentation, sales, or client approval.', 54900, 'usd', null, 4, 2, 2, 4, true, 3)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  included_views = excluded.included_views,
  revision_rounds = excluded.revision_rounds,
  estimated_delivery_days_min = excluded.estimated_delivery_days_min,
  estimated_delivery_days_max = excluded.estimated_delivery_days_max,
  active = excluded.active,
  sort_order = excluded.sort_order;

alter table public.profiles enable row level security;
alter table public.packages enable row level security;
alter table public.orders enable row level security;
alter table public.order_files enable row level security;
alter table public.payments enable row level security;
alter table public.worker_runs enable row level security;
alter table public.email_events enable row level security;

drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles can update own name" on public.profiles;
create policy "profiles can update own name"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "active packages are public" on public.packages;
create policy "active packages are public"
on public.packages for select
to anon, authenticated
using (active = true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('customer-uploads', 'customer-uploads', false, 104857600, array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]),
  ('render-outputs', 'render-outputs', false, 104857600, array[
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/octet-stream'
  ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.claim_order_for_worker(order_id_input uuid, worker_id_input text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.orders;
begin
  update public.orders
  set
    status = 'processing',
    assigned_worker_id = worker_id_input,
    processing_started_at = coalesce(processing_started_at, now()),
    updated_at = now()
  where id = order_id_input
    and status = 'paid_pending_processing'
    and assigned_worker_id is null
  returning * into claimed;

  if claimed.id is not null then
    insert into public.worker_runs (worker_id, order_id, status, logs)
    values (worker_id_input, claimed.id, 'claimed', 'Job claimed by worker.');
  end if;

  return claimed;
end;
$$;

comment on table public.orders is 'Rendering orders. Public access is through unguessable public_token routes; worker access is through server API bearer auth.';
comment on function public.claim_order_for_worker(uuid, text) is 'Atomic worker claim. Keeps the owner PC pull-based and avoids exposing Blender or local MCP services.';
