begin;

-- Cuadrabot takeoff-only, self-serve SaaS foundation.
--
-- This is intentionally a forward migration. The legacy rendering/order tables,
-- columns, storage buckets, and rows remain intact for audit and migration
-- purposes. New application code should use the takeoff_* and billing tables
-- below.

-- ---------------------------------------------------------------------------
-- Customer profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists status text not null default 'active',
  add column if not exists company_name text,
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists timezone text,
  add column if not exists location_source text,
  add column if not exists stripe_customer_id text,
  add column if not exists free_sample_used_at timestamptz,
  add column if not exists last_seen_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_status_check,
  add constraint profiles_status_check
    check (status in ('active', 'suspended', 'closed')),
  drop constraint if exists profiles_country_code_check,
  add constraint profiles_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  drop constraint if exists profiles_location_source_check,
  add constraint profiles_location_source_check
    check (
      location_source is null
      or location_source in ('user', 'billing', 'edge', 'admin', 'unknown')
    );

create unique index if not exists profiles_stripe_customer_id_unique_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_status_created_at_idx
  on public.profiles (status, created_at desc);

create index if not exists profiles_location_idx
  on public.profiles (country_code, region)
  where country_code is not null;

-- ---------------------------------------------------------------------------
-- Billing catalog and subscription state
-- ---------------------------------------------------------------------------

create table if not exists public.billing_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  plan_type text not null check (plan_type in ('credit_pack', 'subscription')),
  currency text not null default 'usd'
    check (currency ~ '^[a-z]{3}$'),
  price_cents integer not null check (price_cents > 0),
  credits integer not null check (credits > 0),
  billing_interval text not null
    check (billing_interval in ('one_time', 'month', 'year')),
  stripe_product_id text,
  stripe_price_id text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_plans_type_interval_check check (
    (plan_type = 'credit_pack' and billing_interval = 'one_time')
    or
    (plan_type = 'subscription' and billing_interval in ('month', 'year'))
  )
);

create unique index if not exists billing_plans_stripe_price_id_unique_idx
  on public.billing_plans (stripe_price_id)
  where stripe_price_id is not null;

create index if not exists billing_plans_active_sort_idx
  on public.billing_plans (plan_type, active, sort_order);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  billing_plan_id uuid references public.billing_plans(id) on delete restrict,
  stripe_subscription_id text not null unique,
  stripe_price_id text,
  status text not null check (
    status in (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  trial_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_updated_at_idx
  on public.subscriptions (user_id, updated_at desc);

create index if not exists subscriptions_billing_plan_id_idx
  on public.subscriptions (billing_plan_id)
  where billing_plan_id is not null;

create index if not exists subscriptions_status_period_end_idx
  on public.subscriptions (status, current_period_end);

create unique index if not exists subscriptions_one_current_per_user_idx
  on public.subscriptions (user_id)
  where status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused');

create table if not exists public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  billing_plan_id uuid references public.billing_plans(id) on delete set null,
  sku text not null check (btrim(sku) <> ''),
  kind text not null check (kind in ('credit_pack', 'subscription')),
  status text not null default 'pending' check (
    status in (
      'pending',
      'checkout_created',
      'paid',
      'fulfilled',
      'failed',
      'canceled',
      'expired',
      'refunded'
    )
  ),
  catalog_version integer not null default 1 check (catalog_version > 0),
  credits integer not null check (credits > 0),
  amount integer not null check (amount > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_price_id text not null check (stripe_price_id ~ '^price_'),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  checkout_created_at timestamptz,
  paid_at timestamptz,
  fulfilled_at timestamptz,
  failed_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_orders_checkout_session_unique_idx
  on public.billing_orders (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists billing_orders_payment_intent_unique_idx
  on public.billing_orders (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists billing_orders_subscription_unique_idx
  on public.billing_orders (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists billing_orders_invoice_unique_idx
  on public.billing_orders (stripe_invoice_id)
  where stripe_invoice_id is not null;

create index if not exists billing_orders_user_created_at_idx
  on public.billing_orders (user_id, created_at desc);

create index if not exists billing_orders_status_updated_at_idx
  on public.billing_orders (status, updated_at);

create unique index if not exists billing_orders_one_open_subscription_checkout_idx
  on public.billing_orders (user_id)
  where kind = 'subscription'
    and status in ('pending', 'checkout_created');

create index if not exists billing_orders_billing_plan_id_idx
  on public.billing_orders (billing_plan_id)
  where billing_plan_id is not null;

create table if not exists public.stripe_credit_fulfillments (
  source_type text not null
    check (source_type in ('stripe_checkout_session', 'stripe_invoice')),
  source_id text not null check (btrim(source_id) <> ''),
  user_id uuid not null references public.profiles(id) on delete restrict,
  billing_order_id uuid references public.billing_orders(id) on delete set null,
  status text not null check (
    status in (
      'pending',
      'fulfilled',
      'refunded',
      'refund_needs_adjustment',
      'blocked'
    )
  ),
  credits integer check (credits is null or credits > 0),
  refund_id text,
  metadata jsonb not null default '{}'::jsonb,
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_type, source_id)
);

create unique index if not exists stripe_credit_fulfillments_refund_unique_idx
  on public.stripe_credit_fulfillments (refund_id)
  where refund_id is not null;

create index if not exists stripe_credit_fulfillments_order_idx
  on public.stripe_credit_fulfillments (billing_order_id)
  where billing_order_id is not null;

-- ---------------------------------------------------------------------------
-- Credits and takeoff jobs
-- ---------------------------------------------------------------------------

create table if not exists public.credit_accounts (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  balance integer not null default 0 check (balance >= 0),
  lifetime_granted bigint not null default 0 check (lifetime_granted >= 0),
  lifetime_consumed bigint not null default 0 check (lifetime_consumed >= 0),
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists credit_accounts_balance_idx
  on public.credit_accounts (balance);

create table if not exists public.takeoff_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  billing_plan_id uuid references public.billing_plans(id) on delete set null,
  legacy_order_id uuid unique references public.orders(id) on delete set null,
  idempotency_key text unique,
  project_name text not null default 'Untitled takeoff',
  trades text[] not null default '{}'::text[],
  sample_page integer check (sample_page is null or sample_page > 0),
  progress integer not null default 0 check (progress between 0 and 100),
  stage text,
  instructions text,
  qa_notes text,
  due_at timestamptz,
  status text not null default 'draft' check (
    status in (
      'draft',
      'awaiting_upload',
      'ready',
      'queued',
      'processing',
      'needs_review',
      'completed',
      'failed',
      'canceled'
    )
  ),
  priority text not null default 'standard'
    check (priority in ('standard', 'rush')),
  discipline text,
  scope text,
  customer_notes text,
  input_file_count integer not null default 0 check (input_file_count >= 0),
  input_page_count integer not null default 0 check (input_page_count >= 0),
  quoted_credits integer not null default 0 check (quoted_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  consumed_credits integer not null default 0 check (consumed_credits >= 0),
  free_sample boolean not null default false,
  processor_job_id text,
  processor_version text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  verification_token uuid,
  verification_started_at timestamptz,
  claimed_by text,
  claim_token uuid,
  claimed_at timestamptz,
  queued_at timestamptz,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  project_files_retention_at timestamptz,
  project_files_purged_at timestamptz,
  project_files_purge_token uuid,
  project_files_purge_started_at timestamptz,
  project_files_purge_expires_at timestamptz,
  failure_code text,
  failure_message text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_jobs_id_user_unique unique (id, user_id),
  constraint takeoff_jobs_project_name_check
    check (btrim(project_name) <> ''),
  constraint takeoff_jobs_trades_check check (
    trades <@ array[
      'flooring_finishes',
      'drywall_partitions_ceilings',
      'doors_windows_openings'
    ]::text[]
    and cardinality(trades) <= 3
    and (status = 'draft' or cardinality(trades) between 1 and 3)
    and cardinality(trades) = (
      (case when 'flooring_finishes' = any(trades) then 1 else 0 end)
      + (case when 'drywall_partitions_ceilings' = any(trades) then 1 else 0 end)
      + (case when 'doors_windows_openings' = any(trades) then 1 else 0 end)
    )
  ),
  constraint takeoff_jobs_consumption_check
    check (consumed_credits <= reserved_credits),
  constraint takeoff_jobs_project_file_purge_state_check check (
    (
      project_files_purge_token is null
      and project_files_purge_started_at is null
      and project_files_purge_expires_at is null
    )
    or
    (
      project_files_purge_token is not null
      and project_files_purge_started_at is not null
      and project_files_purge_expires_at > project_files_purge_started_at
      and status in ('completed', 'failed', 'canceled')
    )
  ),
  constraint takeoff_jobs_project_files_purged_terminal_check check (
    project_files_purged_at is null
    or status in ('completed', 'failed', 'canceled')
  )
);

create unique index if not exists takeoff_jobs_processor_job_id_unique_idx
  on public.takeoff_jobs (processor_job_id)
  where processor_job_id is not null;

create index if not exists takeoff_jobs_user_created_at_idx
  on public.takeoff_jobs (user_id, created_at desc);

create index if not exists takeoff_jobs_user_status_created_idx
  on public.takeoff_jobs (user_id, status, created_at desc);

create index if not exists takeoff_jobs_billing_plan_id_idx
  on public.takeoff_jobs (billing_plan_id)
  where billing_plan_id is not null;

create index if not exists takeoff_jobs_due_at_idx
  on public.takeoff_jobs (due_at)
  where due_at is not null
    and status not in ('completed', 'failed', 'canceled');

create index if not exists takeoff_jobs_queue_idx
  on public.takeoff_jobs (priority desc, queued_at, created_at)
  where status = 'queued' and claimed_by is null;

create index if not exists takeoff_jobs_processing_idx
  on public.takeoff_jobs (processing_started_at)
  where status = 'processing';

create index if not exists takeoff_jobs_project_file_retention_idx
  on public.takeoff_jobs (project_files_retention_at)
  where status in ('completed', 'failed', 'canceled')
    and project_files_purged_at is null;

create index if not exists takeoff_jobs_project_file_purge_expiry_idx
  on public.takeoff_jobs (project_files_purge_expires_at)
  where project_files_purge_token is not null;

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.credit_accounts(user_id) on delete restrict,
  job_id uuid,
  entry_type text not null check (
    entry_type in (
      'purchase_grant',
      'subscription_grant',
      'free_sample_grant',
      'admin_adjustment',
      'reservation',
      'settlement',
      'release',
      'expiration',
      'refund',
      'reversal'
    )
  ),
  amount integer not null,
  source_type text not null,
  source_id text not null,
  idempotency_key text not null unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint credit_ledger_job_user_fk
    foreign key (job_id, user_id)
    references public.takeoff_jobs(id, user_id)
    on delete restrict,
  constraint credit_ledger_amount_semantics_check check (
    (entry_type = 'reservation' and amount < 0 and job_id is not null)
    or (entry_type = 'settlement' and amount = 0 and job_id is not null)
    or (entry_type = 'release' and amount > 0 and job_id is not null)
    or (
      entry_type in (
        'purchase_grant',
        'subscription_grant',
        'free_sample_grant',
        'refund'
      )
      and amount > 0
    )
    or (entry_type = 'expiration' and amount < 0)
    or (entry_type in ('admin_adjustment', 'reversal') and amount <> 0)
  )
);

create index if not exists credit_ledger_user_created_at_idx
  on public.credit_ledger (user_id, created_at desc);

create index if not exists credit_ledger_job_created_at_idx
  on public.credit_ledger (job_id, created_at)
  where job_id is not null;

create index if not exists credit_ledger_expires_at_idx
  on public.credit_ledger (expires_at)
  where expires_at is not null;

create unique index if not exists credit_ledger_source_once_idx
  on public.credit_ledger (user_id, source_type, source_id, entry_type);

create unique index if not exists credit_ledger_job_stage_once_idx
  on public.credit_ledger (job_id, entry_type)
  where job_id is not null
    and entry_type in ('reservation', 'settlement', 'release');

create table if not exists public.takeoff_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  user_id uuid not null,
  legacy_order_file_id uuid unique references public.order_files(id) on delete set null,
  bucket text not null check (bucket in ('takeoff-uploads', 'takeoff-results')),
  storage_path text not null,
  original_filename text not null,
  file_role text not null check (
    file_role in ('input', 'result', 'manifest', 'preview', 'log')
  ),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text,
  page_count integer check (page_count is null or page_count >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint takeoff_files_job_user_fk
    foreign key (job_id, user_id)
    references public.takeoff_jobs(id, user_id)
    on delete cascade,
  constraint takeoff_files_bucket_path_unique unique (bucket, storage_path),
  constraint takeoff_files_role_bucket_check check (
    (file_role = 'input' and bucket = 'takeoff-uploads')
    or
    (file_role <> 'input' and bucket = 'takeoff-results')
  )
);

create index if not exists takeoff_files_job_created_at_idx
  on public.takeoff_files (job_id, created_at);

create index if not exists takeoff_files_user_role_idx
  on public.takeoff_files (user_id, file_role, created_at desc);

create table if not exists public.takeoff_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  user_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type text not null default 'system'
    check (actor_type in ('user', 'admin', 'service', 'system')),
  actor_user_id uuid references public.profiles(id) on delete set null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint takeoff_job_events_job_user_fk
    foreign key (job_id, user_id)
    references public.takeoff_jobs(id, user_id)
    on delete cascade
);

create index if not exists takeoff_job_events_job_created_at_idx
  on public.takeoff_job_events (job_id, created_at);

create index if not exists takeoff_job_events_user_created_at_idx
  on public.takeoff_job_events (user_id, created_at desc);

create index if not exists takeoff_job_events_actor_user_id_idx
  on public.takeoff_job_events (actor_user_id)
  where actor_user_id is not null;

-- ---------------------------------------------------------------------------
-- Stripe ingestion, analytics, administration, and service health
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  livemode boolean not null default false,
  api_version text,
  status text not null default 'received' check (
    status in ('received', 'processing', 'processed', 'failed', 'ignored')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  event_created_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stripe_events_status_created_at_idx
  on public.stripe_events (status, created_at);

create index if not exists stripe_events_type_event_created_idx
  on public.stripe_events (event_type, event_created_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  job_id uuid,
  anonymous_id text,
  session_id text,
  event_name text not null,
  country_code text,
  region text,
  city text,
  source text,
  medium text,
  campaign text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint analytics_events_job_user_fk
    foreign key (job_id, user_id)
    references public.takeoff_jobs(id, user_id)
    on delete set null,
  constraint analytics_events_job_owner_check
    check (job_id is null or user_id is not null),
  constraint analytics_events_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint analytics_events_identity_check
    check (user_id is not null or anonymous_id is not null)
);

create index if not exists analytics_events_name_occurred_at_idx
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists analytics_events_user_occurred_at_idx
  on public.analytics_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists analytics_events_job_occurred_at_idx
  on public.analytics_events (job_id, occurred_at desc)
  where job_id is not null;

create index if not exists analytics_events_geo_occurred_at_idx
  on public.analytics_events (country_code, region, occurred_at desc)
  where country_code is not null;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_actor_created_at_idx
  on public.admin_audit_log (actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id, created_at desc);

create table if not exists public.admin_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'warning'
    check (severity in ('info', 'warning', 'critical')),
  category text not null
    check (category in ('billing', 'worker', 'data', 'security', 'system')),
  title text not null check (btrim(title) <> ''),
  message text not null check (btrim(message) <> ''),
  status text not null default 'open'
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  dedupe_key text,
  entity_type text,
  entity_id text,
  user_id uuid references public.profiles(id) on delete set null,
  job_id uuid references public.takeoff_jobs(id) on delete set null,
  billing_order_id uuid references public.billing_orders(id) on delete set null,
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_alerts_entity_pair_check check (
    (entity_type is null and entity_id is null)
    or (nullif(btrim(entity_type), '') is not null and nullif(btrim(entity_id), '') is not null)
  ),
  constraint admin_alerts_seen_order_check
    check (last_seen_at >= first_seen_at)
);

create unique index if not exists admin_alerts_active_dedupe_unique_idx
  on public.admin_alerts (dedupe_key)
  where dedupe_key is not null
    and status in ('open', 'acknowledged');

create index if not exists admin_alerts_status_severity_last_seen_idx
  on public.admin_alerts (status, severity, last_seen_at desc);

create index if not exists admin_alerts_category_last_seen_idx
  on public.admin_alerts (category, last_seen_at desc);

create index if not exists admin_alerts_user_id_idx
  on public.admin_alerts (user_id)
  where user_id is not null;

create index if not exists admin_alerts_job_id_idx
  on public.admin_alerts (job_id)
  where job_id is not null;

create index if not exists admin_alerts_billing_order_id_idx
  on public.admin_alerts (billing_order_id)
  where billing_order_id is not null;

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text not null default '',
  public_readable boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_health (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  check_name text not null,
  status text not null default 'unknown'
    check (status in ('healthy', 'degraded', 'down', 'unknown')),
  message text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_health_service_check_unique unique (service_name, check_name)
);

create index if not exists service_health_status_checked_at_idx
  on public.service_health (status, checked_at desc);

create index if not exists service_health_expires_at_idx
  on public.service_health (expires_at)
  where expires_at is not null;

create table if not exists public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  constraint api_rate_limits_bucket_key_check
    check (char_length(bucket_key) between 1 and 200)
);

create index if not exists api_rate_limits_updated_at_idx
  on public.api_rate_limits (updated_at);

-- ---------------------------------------------------------------------------
-- updated_at and integrity triggers
-- ---------------------------------------------------------------------------

drop trigger if exists billing_plans_set_updated_at on public.billing_plans;
create trigger billing_plans_set_updated_at
before update on public.billing_plans
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists billing_orders_set_updated_at on public.billing_orders;
create trigger billing_orders_set_updated_at
before update on public.billing_orders
for each row execute function public.set_updated_at();

drop trigger if exists stripe_credit_fulfillments_set_updated_at
  on public.stripe_credit_fulfillments;
create trigger stripe_credit_fulfillments_set_updated_at
before update on public.stripe_credit_fulfillments
for each row execute function public.set_updated_at();

drop trigger if exists credit_accounts_set_updated_at on public.credit_accounts;
create trigger credit_accounts_set_updated_at
before update on public.credit_accounts
for each row execute function public.set_updated_at();

drop trigger if exists takeoff_jobs_set_updated_at on public.takeoff_jobs;
create trigger takeoff_jobs_set_updated_at
before update on public.takeoff_jobs
for each row execute function public.set_updated_at();

create or replace function public.guard_takeoff_project_file_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status is distinct from new.status
       and old.project_files_purge_token is not null
       and old.project_files_purge_expires_at > now() then
      raise exception
        'Project files are in an active retention operation. Retry after it finishes.';
    end if;
  end if;

  if new.status not in ('completed', 'failed', 'canceled') then
    new.project_files_retention_at := null;
    new.project_files_purged_at := null;
    new.project_files_purge_token := null;
    new.project_files_purge_started_at := null;
    new.project_files_purge_expires_at := null;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.project_files_retention_at := now();
    new.project_files_purged_at := null;
  elsif old.status is distinct from new.status
        or new.project_files_retention_at is null then
    new.project_files_retention_at := now();
    new.project_files_purged_at := null;
  end if;

  if new.project_files_purge_token is not null
     and (
       new.project_files_purge_started_at is null
       or new.project_files_purge_expires_at is null
       or new.project_files_purge_expires_at <= now()
     ) then
    raise exception 'A project-file purge claim requires a future expiry.';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_takeoff_project_file_retention()
  from public, anon, authenticated;

drop trigger if exists takeoff_jobs_guard_project_file_retention
  on public.takeoff_jobs;
create trigger takeoff_jobs_guard_project_file_retention
before insert or update on public.takeoff_jobs
for each row execute function public.guard_takeoff_project_file_retention();

create or replace function public.guard_takeoff_file_insert_during_retention()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
begin
  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = new.job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found for project file.';
  end if;

  if job.project_files_purge_token is not null
     and job.project_files_purge_expires_at > now() then
    raise exception
      'Project files are in an active retention operation. Retry after it finishes.';
  end if;

  if job.status in ('completed', 'failed', 'canceled') then
    update public.takeoff_jobs as takeoff_job
    set
      project_files_retention_at = now(),
      project_files_purged_at = null,
      project_files_purge_token = null,
      project_files_purge_started_at = null,
      project_files_purge_expires_at = null
    where takeoff_job.id = job.id;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_takeoff_file_insert_during_retention()
  from public, anon, authenticated;

drop trigger if exists takeoff_files_guard_retention_insert
  on public.takeoff_files;
create trigger takeoff_files_guard_retention_insert
before insert on public.takeoff_files
for each row execute function public.guard_takeoff_file_insert_during_retention();

drop trigger if exists stripe_events_set_updated_at on public.stripe_events;
create trigger stripe_events_set_updated_at
before update on public.stripe_events
for each row execute function public.set_updated_at();

drop trigger if exists admin_alerts_set_updated_at on public.admin_alerts;
create trigger admin_alerts_set_updated_at
before update on public.admin_alerts
for each row execute function public.set_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

drop trigger if exists service_health_set_updated_at on public.service_health;
create trigger service_health_set_updated_at
before update on public.service_health
for each row execute function public.set_updated_at();

drop trigger if exists api_rate_limits_set_updated_at on public.api_rate_limits;
create trigger api_rate_limits_set_updated_at
before update on public.api_rate_limits
for each row execute function public.set_updated_at();

create or replace function public.enforce_takeoff_draft_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  outstanding_count integer;
begin
  if new.status <> 'awaiting_upload' then
    return new;
  end if;

  -- Lock one stable row per customer so parallel draft inserts cannot bypass
  -- the outstanding-upload cap.
  perform 1
  from public.profiles as profile
  where profile.id = new.user_id
  for update;

  select count(*)
  into outstanding_count
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.user_id = new.user_id
    and takeoff_job.status in ('awaiting_upload', 'ready');

  if outstanding_count >= 3 then
    raise exception
      'Finish or wait for an existing upload before creating another takeoff.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_takeoff_draft_limit()
  from public, anon, authenticated;

drop trigger if exists takeoff_jobs_enforce_draft_limit
  on public.takeoff_jobs;
create trigger takeoff_jobs_enforce_draft_limit
before insert on public.takeoff_jobs
for each row execute function public.enforce_takeoff_draft_limit();

create or replace function public.ensure_credit_account_for_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.ensure_credit_account_for_profile()
  from public, anon, authenticated;

drop trigger if exists profiles_ensure_credit_account on public.profiles;
create trigger profiles_ensure_credit_account
after insert on public.profiles
for each row execute function public.ensure_credit_account_for_profile();

insert into public.credit_accounts (user_id)
select profile.id
from public.profiles as profile
on conflict (user_id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    company_name
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), '')
    ),
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'company_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'company'), '')
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_name = coalesce(excluded.company_name, public.profiles.company_name);

  insert into public.credit_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

create or replace function public.validate_credit_ledger_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  job_owner uuid;
  reserved_amount integer;
begin
  if new.job_id is not null then
    select job.user_id
    into job_owner
    from public.takeoff_jobs as job
    where job.id = new.job_id;

    if job_owner is null or job_owner <> new.user_id then
      raise exception 'Credit ledger job ownership does not match the account.';
    end if;
  end if;

  if new.entry_type in ('reservation', 'settlement', 'release') then
    if new.source_type <> 'takeoff_job'
       or new.source_id <> new.job_id::text then
      raise exception 'Takeoff credit entries must use their job as the source.';
    end if;
  end if;

  if new.entry_type in ('settlement', 'release') then
    select entry.amount
    into reserved_amount
    from public.credit_ledger as entry
    where entry.job_id = new.job_id
      and entry.entry_type = 'reservation';

    if reserved_amount is null then
      raise exception 'A reservation is required before settlement or release.';
    end if;
  end if;

  if new.entry_type = 'settlement'
     and exists (
       select 1
       from public.credit_ledger as entry
       where entry.job_id = new.job_id
         and entry.entry_type = 'release'
     ) then
    raise exception 'Released credits cannot be settled.';
  end if;

  if new.entry_type = 'release' then
    if exists (
      select 1
      from public.credit_ledger as entry
      where entry.job_id = new.job_id
        and entry.entry_type = 'settlement'
    ) then
      raise exception 'Settled credits cannot be released.';
    end if;

    if new.amount <> abs(reserved_amount) then
      raise exception 'A release must restore the full reservation.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_credit_ledger_entry()
  from public, anon, authenticated;

drop trigger if exists credit_ledger_validate_insert on public.credit_ledger;
create trigger credit_ledger_validate_insert
before insert on public.credit_ledger
for each row execute function public.validate_credit_ledger_entry();

create or replace function public.prevent_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'credit_ledger is immutable; append a compensating entry instead.';
end;
$$;

revoke execute on function public.prevent_credit_ledger_mutation()
  from public, anon, authenticated;

drop trigger if exists credit_ledger_prevent_mutation on public.credit_ledger;
create trigger credit_ledger_prevent_mutation
before update or delete on public.credit_ledger
for each row execute function public.prevent_credit_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Private Storage buckets and customer-owned object paths
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'takeoff-uploads',
    'takeoff-uploads',
    false,
    104857600,
    array['application/pdf']
  ),
  (
    'takeoff-results',
    'takeoff-results',
    false,
    104857600,
    array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json',
      'application/zip',
      'application/octet-stream'
    ]
  )
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.status = 'active'
  );
$$;

revoke execute on function public.current_user_is_active()
  from public, anon;
grant execute on function public.current_user_is_active()
  to authenticated, service_role;

drop policy if exists "takeoff uploads owner read" on storage.objects;
create policy "takeoff uploads owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'takeoff-uploads'
  and (select public.current_user_is_active())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.takeoff_jobs as job
    where job.id::text = (storage.foldername(name))[2]
      and job.user_id = (select auth.uid())
  )
);

drop policy if exists "takeoff uploads owner insert" on storage.objects;
drop policy if exists "takeoff uploads owner update" on storage.objects;
drop policy if exists "takeoff uploads owner delete" on storage.objects;

drop policy if exists "takeoff results owner read" on storage.objects;
create policy "takeoff results owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'takeoff-results'
  and (select public.current_user_is_active())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.takeoff_jobs as job
    where job.id::text = (storage.foldername(name))[2]
      and job.user_id = (select auth.uid())
      and (
        job.status = 'completed'
        or (
          job.status = 'needs_review'
          and exists (
            select 1
            from public.takeoff_job_events as event
            where event.job_id = job.id
              and event.event_type = 'correction_requested'
          )
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Row-level security and explicit Data API privileges
-- ---------------------------------------------------------------------------

alter table public.billing_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_orders enable row level security;
alter table public.stripe_credit_fulfillments enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.takeoff_jobs enable row level security;
alter table public.takeoff_files enable row level security;
alter table public.takeoff_job_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.analytics_events enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.admin_alerts enable row level security;
alter table public.app_settings enable row level security;
alter table public.service_health enable row level security;
alter table public.api_rate_limits enable row level security;

-- The prior profile update policy only protected role, so adding billing and
-- account-status columns would make those sensitive fields customer-editable.
-- Profile mutations now go through trusted server code.
drop policy if exists "profiles can update own name" on public.profiles;
drop policy if exists "profiles can read own profile" on public.profiles;
create policy "profiles can read own profile"
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  and (select public.current_user_is_active())
);

drop policy if exists "active billing plans are public" on public.billing_plans;
create policy "active billing plans are public"
on public.billing_plans
for select
to anon, authenticated
using (active = true);

drop policy if exists "customers read own subscriptions" on public.subscriptions;
create policy "customers read own subscriptions"
on public.subscriptions
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own billing orders" on public.billing_orders;
create policy "customers read own billing orders"
on public.billing_orders
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own credit account" on public.credit_accounts;
create policy "customers read own credit account"
on public.credit_accounts
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own credit ledger" on public.credit_ledger;
create policy "customers read own credit ledger"
on public.credit_ledger
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own takeoff jobs" on public.takeoff_jobs;
create policy "customers read own takeoff jobs"
on public.takeoff_jobs
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own takeoff files" on public.takeoff_files;
create policy "customers read own takeoff files"
on public.takeoff_files
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
  and (
    file_role = 'input'
    or exists (
      select 1
      from public.takeoff_jobs as job
      where job.id = takeoff_files.job_id
        and job.user_id = (select auth.uid())
        and (
          job.status = 'completed'
          or (
            job.status = 'needs_review'
            and exists (
              select 1
              from public.takeoff_job_events as event
              where event.job_id = job.id
                and event.event_type = 'correction_requested'
            )
          )
        )
        and takeoff_files.storage_path like
          job.user_id::text || '/' || job.id::text || '/results/'
          || job.claim_token::text || '/%'
    )
  )
);

drop policy if exists "customers read own takeoff job events" on public.takeoff_job_events;
create policy "customers read own takeoff job events"
on public.takeoff_job_events
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "customers read own analytics events" on public.analytics_events;
create policy "customers read own analytics events"
on public.analytics_events
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

drop policy if exists "admins read operational alerts" on public.admin_alerts;
create policy "admins read operational alerts"
on public.admin_alerts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.role = 'admin'
      and profile.status = 'active'
  )
);

drop policy if exists "public app settings are readable" on public.app_settings;
create policy "public app settings are readable"
on public.app_settings
for select
to anon, authenticated
using (public_readable = true);

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.billing_plans from public, anon, authenticated;
grant select on table public.billing_plans to anon, authenticated;

revoke all on table public.subscriptions from public, anon, authenticated;
grant select on table public.subscriptions to authenticated;

revoke all on table public.billing_orders from public, anon, authenticated;
grant select on table public.billing_orders to authenticated;

revoke all on table public.stripe_credit_fulfillments
  from public, anon, authenticated;

revoke all on table public.credit_accounts from public, anon, authenticated;
grant select on table public.credit_accounts to authenticated;

revoke all on table public.credit_ledger from public, anon, authenticated;
grant select on table public.credit_ledger to authenticated;

revoke all on table public.takeoff_jobs from public, anon, authenticated;
grant select on table public.takeoff_jobs to authenticated;

revoke all on table public.takeoff_files from public, anon, authenticated;
grant select on table public.takeoff_files to authenticated;

revoke all on table public.takeoff_job_events from public, anon, authenticated;
grant select on table public.takeoff_job_events to authenticated;

revoke all on table public.stripe_events from public, anon, authenticated;

revoke all on table public.analytics_events from public, anon, authenticated;
grant select on table public.analytics_events to authenticated;

revoke all on table public.admin_audit_log from public, anon, authenticated;

revoke all on table public.admin_alerts from public, anon, authenticated;
grant select on table public.admin_alerts to authenticated;

revoke all on table public.app_settings from public, anon, authenticated;
grant select on table public.app_settings to anon, authenticated;

revoke all on table public.service_health from public, anon, authenticated;

revoke all on table public.api_rate_limits from public, anon, authenticated;

grant all privileges on table
  public.profiles,
  public.billing_plans,
  public.subscriptions,
  public.billing_orders,
  public.stripe_credit_fulfillments,
  public.credit_accounts,
  public.credit_ledger,
  public.takeoff_jobs,
  public.takeoff_files,
  public.takeoff_job_events,
  public.stripe_events,
  public.analytics_events,
  public.admin_audit_log,
  public.admin_alerts,
  public.app_settings,
  public.service_health,
  public.api_rate_limits
to service_role;

-- Browser uploads use a server-created, one-object signed upload token.
-- Authenticated sessions can read owned objects but cannot create arbitrary
-- paths or mutate a plan after server verification.
revoke insert, update, delete on table storage.objects from authenticated;
grant select on table storage.objects to authenticated;

-- ---------------------------------------------------------------------------
-- Service-role-only credit and queue RPCs
-- ---------------------------------------------------------------------------

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_entry_type text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.credit_accounts;
  existing_entry public.credit_ledger;
begin
  if p_user_id is null then
    raise exception 'A user is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Credit grants must be a positive integer.';
  end if;

  if p_entry_type not in (
    'purchase_grant',
    'subscription_grant',
    'free_sample_grant',
    'admin_adjustment',
    'refund',
    'reversal'
  ) then
    raise exception 'Unsupported credit grant type: %', p_entry_type;
  end if;

  if nullif(btrim(p_source_type), '') is null
     or nullif(btrim(p_source_id), '') is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Credit grants require source and idempotency identifiers.';
  end if;

  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = p_user_id
  for update;

  select ledger.*
  into existing_entry
  from public.credit_ledger as ledger
  where ledger.idempotency_key = p_idempotency_key
     or (
       ledger.user_id = p_user_id
       and ledger.source_type = p_source_type
       and ledger.source_id = p_source_id
       and ledger.entry_type = p_entry_type
     )
  order by ledger.created_at
  limit 1;

  if existing_entry.id is not null then
    if existing_entry.user_id <> p_user_id
       or existing_entry.amount <> p_amount
       or existing_entry.entry_type <> p_entry_type
       or existing_entry.source_type <> p_source_type
       or existing_entry.source_id <> p_source_id then
      raise exception 'The credit grant idempotency key is already used by another operation.';
    end if;

    return account;
  end if;

  insert into public.credit_ledger (
    user_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    metadata,
    expires_at
  )
  values (
    p_user_id,
    p_entry_type,
    p_amount,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb),
    p_expires_at
  );

  update public.credit_accounts as credit_account
  set
    balance = credit_account.balance + p_amount,
    lifetime_granted = credit_account.lifetime_granted + p_amount,
    version = credit_account.version + 1
  where credit_account.user_id = p_user_id
  returning credit_account.* into account;

  return account;
end;
$$;

create or replace function public.reverse_credit_grant(
  p_user_id uuid,
  p_grant_source_type text,
  p_grant_source_id text,
  p_idempotency_key text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text,
  p_metadata jsonb
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.credit_accounts;
  original_grant public.credit_ledger;
  existing_reversal public.credit_ledger;
begin
  if p_user_id is null
     or nullif(btrim(p_grant_source_type), '') is null
     or nullif(btrim(p_grant_source_id), '') is null
     or nullif(btrim(p_idempotency_key), '') is null
     or nullif(btrim(p_reason), '') is null then
    raise exception 'A customer, grant source, idempotency key, and reason are required.';
  end if;

  if p_actor_user_id is not null
     and not exists (
       select 1
       from public.profiles as actor
       where actor.id = p_actor_user_id
         and actor.role = 'admin'
         and actor.status = 'active'
     ) then
    raise exception 'The credit reversal actor is not an active admin.';
  end if;

  select ledger.*
  into original_grant
  from public.credit_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.source_type = p_grant_source_type
    and ledger.source_id = p_grant_source_id
    and ledger.entry_type in ('purchase_grant', 'subscription_grant')
  for update;

  if original_grant.id is null then
    raise exception 'The original Stripe credit grant was not found.';
  end if;

  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = p_user_id
  for update;

  select ledger.*
  into existing_reversal
  from public.credit_ledger as ledger
  where ledger.idempotency_key = p_idempotency_key
     or (
       ledger.user_id = p_user_id
       and ledger.source_type = 'credit_grant_reversal'
       and ledger.source_id = original_grant.id::text
       and ledger.entry_type = 'reversal'
     )
  order by ledger.created_at
  limit 1;

  if existing_reversal.id is not null then
    if existing_reversal.user_id <> p_user_id
       or existing_reversal.amount <> -original_grant.amount
       or existing_reversal.source_id <> original_grant.id::text then
      raise exception 'The credit reversal idempotency key is already used by another operation.';
    end if;

    return account;
  end if;

  if account.balance < original_grant.amount then
    raise exception
      'The original grant cannot be fully reversed because some credits are no longer available.';
  end if;

  insert into public.credit_ledger (
    user_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    description,
    metadata
  )
  values (
    p_user_id,
    'reversal',
    -original_grant.amount,
    'credit_grant_reversal',
    original_grant.id::text,
    p_idempotency_key,
    left(p_reason, 500),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'original_grant_id',
        original_grant.id,
        'original_source_type',
        original_grant.source_type,
        'original_source_id',
        original_grant.source_id
      )
  );

  update public.credit_accounts as credit_account
  set
    balance = credit_account.balance - original_grant.amount,
    version = credit_account.version + 1
  where credit_account.user_id = p_user_id
  returning credit_account.* into account;

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state,
    metadata
  )
  values (
    p_actor_user_id,
    coalesce(nullif(btrim(p_actor_email), ''), 'stripe-webhook'),
    'credit_grant.reversed',
    'credit_account',
    p_user_id::text,
    left(p_reason, 500),
    jsonb_build_object('balance', account.balance + original_grant.amount),
    jsonb_build_object('balance', account.balance),
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('credits_reversed', original_grant.amount)
  );

  return account;
end;
$$;

create or replace function public.fulfill_stripe_credit_grant(
  p_user_id uuid,
  p_amount integer,
  p_entry_type text,
  p_source_type text,
  p_source_id text,
  p_idempotency_key text,
  p_billing_order_id uuid,
  p_stripe_price_id text,
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_stripe_subscription_id text,
  p_stripe_invoice_id text,
  p_paid_at timestamptz,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  control public.stripe_credit_fulfillments;
  billing_order public.billing_orders;
begin
  if p_user_id is null
     or p_amount is null
     or p_amount <= 0
     or p_entry_type not in ('purchase_grant', 'subscription_grant')
     or p_source_type not in ('stripe_checkout_session', 'stripe_invoice')
     or nullif(btrim(p_source_id), '') is null
     or nullif(btrim(p_idempotency_key), '') is null
     or nullif(btrim(p_stripe_price_id), '') is null
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
     or (
       p_entry_type = 'purchase_grant'
       and p_source_type <> 'stripe_checkout_session'
     )
     or (
       p_entry_type = 'subscription_grant'
       and p_source_type <> 'stripe_invoice'
     ) then
    raise exception 'The Stripe credit fulfillment request is invalid.';
  end if;

  insert into public.stripe_credit_fulfillments (
    source_type,
    source_id,
    user_id,
    billing_order_id,
    status,
    credits,
    metadata
  )
  values (
    p_source_type,
    p_source_id,
    p_user_id,
    p_billing_order_id,
    'pending',
    p_amount,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_type, source_id) do nothing;

  select fulfillment.*
  into control
  from public.stripe_credit_fulfillments as fulfillment
  where fulfillment.source_type = p_source_type
    and fulfillment.source_id = p_source_id
  for update;

  if control.user_id <> p_user_id
     or (
       control.credits is not null
       and control.credits <> p_amount
     )
     or (
       control.billing_order_id is not null
       and control.billing_order_id is distinct from p_billing_order_id
     ) then
    raise exception 'The Stripe credit source is already linked to another fulfillment.';
  end if;

  if control.status in ('refunded', 'refund_needs_adjustment') then
    return jsonb_build_object(
      'status',
      'refund_suppressed',
      'granted',
      false,
      'requires_follow_up',
      control.status = 'refund_needs_adjustment'
    );
  end if;

  if control.status = 'blocked' then
    return jsonb_build_object(
      'status',
      'blocked',
      'granted',
      false,
      'requires_follow_up',
      true
    );
  end if;

  if p_billing_order_id is not null then
    select billing.*
    into billing_order
    from public.billing_orders as billing
    where billing.id = p_billing_order_id
    for update;

    if billing_order.id is null
       or billing_order.user_id <> p_user_id
       or billing_order.credits <> p_amount
       or billing_order.stripe_price_id <> p_stripe_price_id
       or (
         billing_order.kind = 'credit_pack'
         and p_source_type <> 'stripe_checkout_session'
       )
       or (
         billing_order.kind = 'subscription'
         and p_source_type <> 'stripe_invoice'
       ) then
      raise exception 'The billing order does not match the Stripe credit fulfillment.';
    end if;

    if billing_order.status = 'refunded' then
      update public.stripe_credit_fulfillments
      set
        status = 'refunded',
        billing_order_id = billing_order.id,
        credits = coalesce(credits, p_amount),
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
        refunded_at = coalesce(refunded_at, now())
      where source_type = p_source_type
        and source_id = p_source_id;

      return jsonb_build_object(
        'status',
        'refund_suppressed',
        'granted',
        false,
        'requires_follow_up',
        false
      );
    end if;

    if billing_order.status in ('canceled', 'expired') then
      update public.stripe_credit_fulfillments
      set
        status = 'blocked',
        billing_order_id = billing_order.id,
        credits = coalesce(credits, p_amount),
        metadata = metadata
          || coalesce(p_metadata, '{}'::jsonb)
          || jsonb_build_object(
            'blocked_reason',
            'billing_order_' || billing_order.status
          )
      where source_type = p_source_type
        and source_id = p_source_id;

      return jsonb_build_object(
        'status',
        'blocked',
        'granted',
        false,
        'requires_follow_up',
        true
      );
    end if;
  end if;

  if control.status = 'fulfilled' then
    return jsonb_build_object(
      'status',
      'fulfilled',
      'granted',
      true,
      'idempotent',
      true,
      'requires_follow_up',
      false
    );
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = p_user_id
    and profile.status = 'active'
  for share;

  if not found then
    update public.stripe_credit_fulfillments
    set
      status = 'blocked',
      credits = coalesce(credits, p_amount),
      metadata = metadata
        || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object('blocked_reason', 'inactive_workspace')
    where source_type = p_source_type
      and source_id = p_source_id;

    if p_billing_order_id is not null then
      update public.billing_orders as billing
      set
        status = 'paid',
        stripe_checkout_session_id = coalesce(
          p_stripe_checkout_session_id,
          billing.stripe_checkout_session_id
        ),
        stripe_payment_intent_id = coalesce(
          p_stripe_payment_intent_id,
          billing.stripe_payment_intent_id
        ),
        stripe_subscription_id = coalesce(
          p_stripe_subscription_id,
          billing.stripe_subscription_id
        ),
        stripe_invoice_id = coalesce(
          p_stripe_invoice_id,
          billing.stripe_invoice_id
        ),
        paid_at = coalesce(billing.paid_at, p_paid_at, now()),
        failure_code = 'inactive_workspace_fulfillment_blocked',
        failure_message =
          'Payment succeeded after the workspace stopped being active.',
        metadata = billing.metadata
          || coalesce(p_metadata, '{}'::jsonb)
          || jsonb_build_object('account_status', 'inactive')
      where billing.id = p_billing_order_id;
    end if;

    return jsonb_build_object(
      'status',
      'inactive_workspace',
      'granted',
      false,
      'requires_follow_up',
      true
    );
  end if;

  perform public.grant_credits(
    p_user_id,
    p_amount,
    p_entry_type,
    p_source_type,
    p_source_id,
    p_idempotency_key,
    null,
    coalesce(p_metadata, '{}'::jsonb)
  );

  update public.stripe_credit_fulfillments
  set
    status = 'fulfilled',
    billing_order_id = coalesce(billing_order_id, p_billing_order_id),
    credits = coalesce(credits, p_amount),
    metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
    fulfilled_at = coalesce(fulfilled_at, now())
  where source_type = p_source_type
    and source_id = p_source_id;

  if p_billing_order_id is not null then
    update public.billing_orders as billing
    set
      status = 'fulfilled',
      stripe_checkout_session_id = coalesce(
        p_stripe_checkout_session_id,
        billing.stripe_checkout_session_id
      ),
      stripe_payment_intent_id = coalesce(
        p_stripe_payment_intent_id,
        billing.stripe_payment_intent_id
      ),
      stripe_subscription_id = coalesce(
        p_stripe_subscription_id,
        billing.stripe_subscription_id
      ),
      stripe_invoice_id = coalesce(
        p_stripe_invoice_id,
        billing.stripe_invoice_id
      ),
      paid_at = coalesce(billing.paid_at, p_paid_at, now()),
      fulfilled_at = coalesce(billing.fulfilled_at, now()),
      failure_code = null,
      failure_message = null,
      metadata = billing.metadata || coalesce(p_metadata, '{}'::jsonb)
    where billing.id = p_billing_order_id;
  end if;

  return jsonb_build_object(
    'status',
    'fulfilled',
    'granted',
    true,
    'idempotent',
    false,
    'requires_follow_up',
    false
  );
end;
$$;

create or replace function public.record_stripe_credit_refund(
  p_user_id uuid,
  p_source_type text,
  p_source_id text,
  p_refund_id text,
  p_billing_order_id uuid,
  p_idempotency_key text,
  p_actor_email text,
  p_reason text,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  control public.stripe_credit_fulfillments;
  billing_order public.billing_orders;
  original_grant public.credit_ledger;
  reversed boolean := false;
  refund_before_grant boolean := false;
  reversal_error text := null;
begin
  if p_user_id is null
     or p_source_type not in ('stripe_checkout_session', 'stripe_invoice')
     or nullif(btrim(p_source_id), '') is null
     or nullif(btrim(p_refund_id), '') is null
     or nullif(btrim(p_idempotency_key), '') is null
     or nullif(btrim(p_reason), '') is null
     or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'The Stripe refund control request is invalid.';
  end if;

  insert into public.stripe_credit_fulfillments (
    source_type,
    source_id,
    user_id,
    billing_order_id,
    status,
    refund_id,
    metadata,
    refunded_at
  )
  values (
    p_source_type,
    p_source_id,
    p_user_id,
    p_billing_order_id,
    'refunded',
    p_refund_id,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  on conflict (source_type, source_id) do nothing;

  select fulfillment.*
  into control
  from public.stripe_credit_fulfillments as fulfillment
  where fulfillment.source_type = p_source_type
    and fulfillment.source_id = p_source_id
  for update;

  if control.user_id <> p_user_id
     or (
       control.billing_order_id is not null
       and control.billing_order_id is distinct from p_billing_order_id
     )
     then
    raise exception 'The Stripe refund is linked to another credit fulfillment.';
  end if;

  if p_billing_order_id is not null then
    select billing.*
    into billing_order
    from public.billing_orders as billing
    where billing.id = p_billing_order_id
    for update;

    if billing_order.id is null or billing_order.user_id <> p_user_id then
      raise exception 'The Stripe refund billing order does not match its customer.';
    end if;
  end if;

  select ledger.*
  into original_grant
  from public.credit_ledger as ledger
  where ledger.user_id = p_user_id
    and ledger.source_type = p_source_type
    and ledger.source_id = p_source_id
    and ledger.entry_type in ('purchase_grant', 'subscription_grant')
  for update;

  refund_before_grant :=
    original_grant.id is null and control.status <> 'fulfilled';
  if control.status = 'fulfilled' and original_grant.id is null then
    reversal_error :=
      'The fulfillment record is complete but its credit grant is missing.';
  end if;

  if original_grant.id is not null then
    begin
      perform public.reverse_credit_grant(
        p_user_id,
        p_source_type,
        p_source_id,
        p_idempotency_key,
        null,
        p_actor_email,
        p_reason,
        coalesce(p_metadata, '{}'::jsonb)
      );
      reversed := true;
    exception
      when others then
        reversal_error := sqlerrm;
    end;
  end if;

  update public.stripe_credit_fulfillments
  set
    status = case
      when reversal_error is null then 'refunded'
      else 'refund_needs_adjustment'
    end,
    billing_order_id = coalesce(billing_order_id, p_billing_order_id),
    credits = coalesce(credits, original_grant.amount),
    refund_id = coalesce(refund_id, p_refund_id),
    metadata = metadata
      || coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'credit_reversal_error',
        reversal_error,
        'refund_before_grant',
        refund_before_grant,
        'observed_refund_ids',
        coalesce(
          metadata -> 'observed_refund_ids',
          '[]'::jsonb
        ) || jsonb_build_array(p_refund_id)
      ),
    refunded_at = coalesce(refunded_at, now())
  where source_type = p_source_type
    and source_id = p_source_id;

  if p_billing_order_id is not null then
    update public.billing_orders as billing
    set
      status = 'refunded',
      metadata = billing.metadata
        || coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'refund_id',
          p_refund_id,
          'credit_reversal_error',
          reversal_error
        )
    where billing.id = p_billing_order_id;
  end if;

  return jsonb_build_object(
    'status',
    case
      when reversal_error is null then 'refunded'
      else 'refund_needs_adjustment'
    end,
    'reversed',
    reversed,
    'refund_before_grant',
    refund_before_grant,
    'requires_follow_up',
    reversal_error is not null,
    'error',
    reversal_error
  );
end;
$$;

create or replace function public.admin_sync_billing_catalog(
  p_catalog jsonb,
  p_actor_user_id uuid,
  p_actor_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item record;
  before_catalog jsonb;
  after_catalog jsonb;
begin
  if p_actor_user_id is null
     or jsonb_typeof(p_catalog) <> 'array'
     or jsonb_array_length(p_catalog) <> 6 then
    raise exception 'The complete six-item billing catalog is required.';
  end if;

  if not exists (
    select 1
    from public.profiles as actor
    where actor.id = p_actor_user_id
      and actor.role = 'admin'
      and actor.status = 'active'
  ) then
    raise exception 'The billing catalog actor is not an active admin.';
  end if;

  if (
    select count(distinct entry.slug)
    from jsonb_to_recordset(p_catalog) as entry(slug text)
  ) <> 6
  or exists (
    select 1
    from jsonb_to_recordset(p_catalog) as entry(slug text)
    where entry.slug not in (
      'credits-550',
      'credits-1800',
      'credits-5000',
      'solo-monthly',
      'team-monthly',
      'office-monthly'
    )
  ) then
    raise exception 'The billing catalog has missing, duplicate, or unknown SKUs.';
  end if;

  select jsonb_agg(to_jsonb(plan) order by plan.sort_order, plan.slug)
  into before_catalog
  from public.billing_plans as plan
  where plan.slug in (
    'credits-550',
    'credits-1800',
    'credits-5000',
    'solo-monthly',
    'team-monthly',
    'office-monthly'
  );

  for item in
    select *
    from jsonb_to_recordset(p_catalog) as entry(
      slug text,
      name text,
      description text,
      plan_type text,
      currency text,
      price_cents integer,
      credits integer,
      billing_interval text,
      stripe_price_id text,
      stripe_product_id text
    )
  loop
    if nullif(btrim(item.name), '') is null
       or item.plan_type not in ('credit_pack', 'subscription')
       or item.currency !~ '^[a-z]{3}$'
       or item.price_cents <= 0
       or item.credits <= 0
       or item.billing_interval not in ('one_time', 'month', 'year')
       or item.stripe_price_id !~ '^price_'
       or item.stripe_product_id !~ '^prod_'
       or (
         item.plan_type = 'credit_pack'
         and item.billing_interval <> 'one_time'
       )
       or (
         item.plan_type = 'subscription'
         and item.billing_interval not in ('month', 'year')
       ) then
      raise exception 'Billing catalog entry % is invalid.', item.slug;
    end if;

    update public.billing_plans as plan
    set
      name = item.name,
      description = coalesce(item.description, ''),
      plan_type = item.plan_type,
      currency = item.currency,
      price_cents = item.price_cents,
      credits = item.credits,
      billing_interval = item.billing_interval,
      stripe_price_id = item.stripe_price_id,
      stripe_product_id = item.stripe_product_id,
      active = true
    where plan.slug = item.slug;

    if not found then
      raise exception 'Billing plan % is missing.', item.slug;
    end if;
  end loop;

  select jsonb_agg(to_jsonb(plan) order by plan.sort_order, plan.slug)
  into after_catalog
  from public.billing_plans as plan
  where plan.slug in (
    'credits-550',
    'credits-1800',
    'credits-5000',
    'solo-monthly',
    'team-monthly',
    'office-monthly'
  );

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    before_state,
    after_state,
    metadata
  )
  values (
    p_actor_user_id,
    coalesce(nullif(btrim(p_actor_email), ''), 'admin'),
    'billing_catalog.synced',
    'billing_catalog',
    'server-catalog-v1',
    jsonb_build_object('plans', coalesce(before_catalog, '[]'::jsonb)),
    jsonb_build_object('plans', coalesce(after_catalog, '[]'::jsonb)),
    jsonb_build_object('plan_count', 6)
  );

  return jsonb_build_object(
    'status',
    'synced',
    'plan_count',
    6
  );
end;
$$;

create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_amount integer,
  p_idempotency_key text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  account public.credit_accounts;
  existing_entry public.credit_ledger;
  prior_balance integer;
begin
  if p_user_id is null
     or p_actor_user_id is null
     or p_amount is null
     or p_amount = 0
     or p_amount not between -100000 and 100000
     or nullif(btrim(p_idempotency_key), '') is null
     or char_length(btrim(coalesce(p_reason, ''))) < 8 then
    raise exception 'A customer, adjustment up to 100,000 credits, idempotency key, and clear reason are required.';
  end if;

  if not exists (
    select 1
    from public.profiles as actor
    where actor.id = p_actor_user_id
      and actor.role = 'admin'
      and actor.status = 'active'
  ) then
    raise exception 'The credit adjustment actor is not an active admin.';
  end if;

  insert into public.credit_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = p_user_id
  for update;

  prior_balance := account.balance;

  select ledger.*
  into existing_entry
  from public.credit_ledger as ledger
  where ledger.idempotency_key = p_idempotency_key;

  if existing_entry.id is not null then
    if existing_entry.user_id <> p_user_id
       or existing_entry.amount <> p_amount
       or existing_entry.entry_type <> 'admin_adjustment' then
      raise exception 'The adjustment idempotency key is already used by another operation.';
    end if;

    return account;
  end if;

  if account.balance + p_amount < 0 then
    raise exception 'This adjustment would make the available credit balance negative.';
  end if;

  insert into public.credit_ledger (
    user_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    description,
    metadata
  )
  values (
    p_user_id,
    'admin_adjustment',
    p_amount,
    'admin_console',
    p_idempotency_key,
    p_idempotency_key,
    left(btrim(p_reason), 500),
    jsonb_build_object('actor_user_id', p_actor_user_id)
  );

  update public.credit_accounts as credit_account
  set
    balance = credit_account.balance + p_amount,
    lifetime_granted =
      credit_account.lifetime_granted + greatest(p_amount, 0),
    version = credit_account.version + 1
  where credit_account.user_id = p_user_id
  returning credit_account.* into account;

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state,
    metadata
  )
  values (
    p_actor_user_id,
    nullif(btrim(p_actor_email), ''),
    'credit_account.adjusted',
    'credit_account',
    p_user_id::text,
    left(btrim(p_reason), 500),
    jsonb_build_object('balance', prior_balance),
    jsonb_build_object('balance', account.balance),
    jsonb_build_object('amount', p_amount, 'idempotency_key', p_idempotency_key)
  );

  return account;
end;
$$;

create or replace function public.admin_set_profile_status(
  p_user_id uuid,
  p_status text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text,
  p_metadata jsonb
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  customer public.profiles;
  updated_profile public.profiles;
begin
  if p_user_id is null
     or p_actor_user_id is null
     or p_status not in ('active', 'suspended') then
    raise exception 'A customer, active admin, and supported status are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null then
    raise exception 'The account-status actor is not an active admin.';
  end if;

  if p_user_id = p_actor_user_id and p_status <> 'active' then
    raise exception 'An admin cannot suspend their own account.';
  end if;

  if p_status = 'suspended'
     and char_length(btrim(coalesce(p_reason, ''))) < 8 then
    raise exception 'A clear suspension reason is required.';
  end if;

  select profile.*
  into customer
  from public.profiles as profile
  where profile.id = p_user_id
  for update;

  if customer.id is null then
    raise exception 'Customer profile not found.';
  end if;

  update public.profiles as profile
  set status = p_status
  where profile.id = customer.id
  returning profile.* into updated_profile;

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state,
    metadata
  )
  values (
    actor.id,
    coalesce(nullif(btrim(p_actor_email), ''), actor.email),
    'profile.status_updated',
    'profile',
    customer.id::text,
    nullif(left(btrim(coalesce(p_reason, '')), 500), ''),
    jsonb_build_object('status', customer.status),
    jsonb_build_object('status', updated_profile.status),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return updated_profile;
end;
$$;

create or replace function public.request_takeoff_correction(
  p_job_id uuid,
  p_user_id uuid,
  p_message text
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  corrected public.takeoff_jobs;
  requested_at timestamptz := now();
begin
  if p_job_id is null
     or p_user_id is null
     or char_length(btrim(coalesce(p_message, ''))) not between 10 and 4000 then
    raise exception 'Describe the correction in 10 to 4,000 characters.';
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = p_user_id
    and profile.status = 'active'
  for share;

  if not found then
    raise exception 'The customer workspace is not active.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
    and takeoff_job.user_id = p_user_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;
  if job.status <> 'completed' then
    raise exception 'Corrections can be requested only after delivery.';
  end if;
  if job.completed_at is null
     or job.completed_at < requested_at - interval '7 days' then
    raise exception 'The included correction window is 7 days after delivery.';
  end if;
  if job.project_files_purged_at is not null then
    raise exception 'The retained project files are no longer available for correction.';
  end if;
  if job.project_files_purge_token is not null
     and job.project_files_purge_expires_at > requested_at then
    raise exception 'Project files are in an active retention operation. Retry after it finishes.';
  end if;
  if exists (
    select 1
    from public.takeoff_job_events as event
    where event.job_id = job.id
      and event.event_type = 'correction_requested'
  ) then
    raise exception 'The included correction has already been requested.';
  end if;
  if not exists (
    select 1
    from public.takeoff_files as file
    where file.job_id = job.id
      and file.user_id = job.user_id
      and file.file_role = 'input'
      and file.verified_at is not null
      and file.storage_path like
        job.user_id::text || '/' || job.id::text || '/%'
  ) then
    raise exception 'The retained source plan is unavailable for correction.';
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'needs_review',
    progress = 90,
    stage = 'correction_requested',
    qa_notes = btrim(p_message),
    result_summary = coalesce(takeoff_job.result_summary, '{}'::jsonb)
      || jsonb_build_object('correction_requested_at', requested_at)
  where takeoff_job.id = job.id
    and takeoff_job.status = 'completed'
  returning takeoff_job.* into corrected;

  if corrected.id is null then
    raise exception 'The takeoff changed before the correction was saved.';
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    message,
    metadata
  )
  values (
    corrected.id,
    corrected.user_id,
    'correction_requested',
    'completed',
    'needs_review',
    'user',
    corrected.user_id,
    'Customer requested the included correction.',
    jsonb_build_object('request', btrim(p_message))
  );

  insert into public.admin_alerts (
    severity,
    category,
    title,
    message,
    status,
    dedupe_key,
    entity_type,
    entity_id,
    user_id,
    job_id
  )
  values (
    'info',
    'data',
    'Customer correction requested',
    btrim(p_message),
    'open',
    'correction:' || corrected.id::text,
    'takeoff_job',
    corrected.id::text,
    corrected.user_id,
    corrected.id
  );

  insert into public.analytics_events (
    user_id,
    job_id,
    event_name,
    source,
    metadata
  )
  values (
    corrected.user_id,
    corrected.id,
    'correction_requested',
    'product',
    jsonb_build_object(
      'days_after_delivery',
      extract(epoch from (requested_at - job.completed_at)) / 86400
    )
  );

  return corrected;
end;
$$;

create or replace function public.admin_resolve_takeoff(
  p_job_id uuid,
  p_decision text,
  p_notes text,
  p_actor_user_id uuid,
  p_actor_email text
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  job public.takeoff_jobs;
  updated_job public.takeoff_jobs;
  result_count integer;
  event_name text;
begin
  if p_job_id is null
     or p_actor_user_id is null
     or p_decision not in ('approve', 'requeue', 'cancel') then
    raise exception 'A takeoff, supported decision, and active admin are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null then
    raise exception 'The takeoff decision actor is not an active admin.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if p_decision = 'approve' then
    if job.status <> 'needs_review' then
      raise exception 'Only a correction or exception can be resolved for delivery.';
    end if;

    select count(distinct takeoff_file.original_filename)
    into result_count
    from public.takeoff_files as takeoff_file
    where takeoff_file.job_id = job.id
      and takeoff_file.file_role = 'result'
      and takeoff_file.verified_at is not null
      and takeoff_file.original_filename in (
        'annotated_drawings.pdf',
        'takeoff.xlsx'
      )
      and job.claim_token is not null
      and takeoff_file.storage_path like
        job.user_id::text || '/' || job.id::text || '/results/'
        || job.claim_token::text || '/%';

    if result_count <> 2 then
      raise exception 'Verified marked-PDF and workbook artifacts are required.';
    end if;

    if job.reserved_credits > 0 and job.consumed_credits = 0 then
      perform public.settle_takeoff_credits(
        job.id,
        'settle:admin-exception:' || job.id::text,
        jsonb_build_object('approved_by', actor.id)
      );
    end if;

    update public.takeoff_jobs as takeoff_job
    set
      status = 'completed',
      progress = 100,
      stage = 'delivered',
      qa_notes = nullif(left(btrim(coalesce(p_notes, '')), 2000), ''),
      completed_at = coalesce(takeoff_job.completed_at, now())
    where takeoff_job.id = job.id
      and takeoff_job.status = 'needs_review'
    returning takeoff_job.* into updated_job;

    event_name := 'takeoff_delivered';

    insert into public.analytics_events (
      user_id,
      job_id,
      event_name,
      source,
      metadata
    )
    values (
      updated_job.user_id,
      updated_job.id,
      'takeoff_delivered',
      'admin',
      jsonb_build_object(
        'credits',
        updated_job.reserved_credits,
        'resolution',
        'correction_or_exception'
      )
    );
  elsif p_decision = 'requeue' then
    if job.status <> 'needs_review' then
      raise exception 'Only a correction or exception can be reprocessed.';
    end if;

    update public.takeoff_jobs as takeoff_job
    set
      status = 'queued',
      progress = 20,
      stage = 'rework_queued',
      qa_notes = coalesce(
        nullif(left(btrim(coalesce(p_notes, '')), 2000), ''),
        'An exception decision requested another processing pass.'
      ),
      claimed_by = null,
      claim_token = null,
      claimed_at = null,
      processor_job_id = null,
      queued_at = now(),
      failed_at = null,
      failure_code = null,
      failure_message = null
    where takeoff_job.id = job.id
      and takeoff_job.status = 'needs_review'
    returning takeoff_job.* into updated_job;

    event_name := 'qa_rework_requested';
  else
    if job.status not in (
      'awaiting_upload',
      'ready',
      'queued',
      'processing',
      'needs_review'
    ) or job.consumed_credits > 0 then
      raise exception 'This takeoff status cannot be canceled.';
    end if;

    if job.reserved_credits > 0 then
      perform public.release_takeoff_credits(
        job.id,
        'release:admin-cancel:' || job.id::text,
        jsonb_build_object(
          'canceled_by',
          actor.id,
          'reason',
          nullif(left(btrim(coalesce(p_notes, '')), 500), '')
        )
      );
    end if;

    update public.takeoff_jobs as takeoff_job
    set
      status = 'canceled',
      stage = 'canceled',
      qa_notes = nullif(left(btrim(coalesce(p_notes, '')), 2000), ''),
      claimed_by = null,
      claim_token = null,
      claimed_at = null,
      verification_token = null,
      verification_started_at = null
    where takeoff_job.id = job.id
      and takeoff_job.status = job.status
      and takeoff_job.consumed_credits = 0
    returning takeoff_job.* into updated_job;

    event_name := 'takeoff_canceled';
  end if;

  if updated_job.id is null then
    raise exception 'The takeoff decision lost its expected state.';
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    message,
    metadata
  )
  values (
    updated_job.id,
    updated_job.user_id,
    event_name,
    job.status,
    updated_job.status,
    'admin',
    actor.id,
    case p_decision
      when 'approve' then 'The correction or exception was resolved for delivery.'
      when 'requeue' then 'The correction or exception was queued for another processing pass.'
      else 'The unfunded or unsettled takeoff was canceled by an admin.'
    end,
    jsonb_build_object(
      'decision',
      p_decision,
      'notes',
      nullif(left(btrim(coalesce(p_notes, '')), 2000), '')
    )
  );

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state
  )
  values (
    actor.id,
    coalesce(nullif(btrim(p_actor_email), ''), actor.email),
    'takeoff.' || p_decision,
    'takeoff_job',
    job.id::text,
    nullif(left(btrim(coalesce(p_notes, '')), 500), ''),
    jsonb_build_object(
      'status',
      job.status,
      'progress',
      job.progress,
      'qa_notes',
      job.qa_notes
    ),
    jsonb_build_object(
      'status',
      updated_job.status,
      'progress',
      updated_job.progress,
      'qa_notes',
      updated_job.qa_notes
    )
  );

  return updated_job;
end;
$$;

create or replace function public.admin_schedule_subscription_cancel(
  p_subscription_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  subscription public.subscriptions;
  updated_subscription public.subscriptions;
begin
  if p_subscription_id is null
     or p_actor_user_id is null
     or char_length(btrim(coalesce(p_reason, ''))) < 8 then
    raise exception 'A subscription, active admin, and clear reason are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null then
    raise exception 'The subscription actor is not an active admin.';
  end if;

  select customer_subscription.*
  into subscription
  from public.subscriptions as customer_subscription
  where customer_subscription.id = p_subscription_id
  for update;

  if subscription.id is null then
    raise exception 'Subscription not found.';
  end if;

  if subscription.status in ('canceled', 'expired', 'incomplete_expired') then
    raise exception 'This subscription is already terminal.';
  end if;

  update public.subscriptions as customer_subscription
  set cancel_at_period_end = true
  where customer_subscription.id = subscription.id
  returning customer_subscription.* into updated_subscription;

  insert into public.admin_audit_log (
    actor_user_id,
    actor_email,
    action,
    target_type,
    target_id,
    reason,
    before_state,
    after_state
  )
  values (
    actor.id,
    coalesce(nullif(btrim(p_actor_email), ''), actor.email),
    'subscription.cancel_at_period_end',
    'subscription',
    subscription.id::text,
    left(btrim(p_reason), 500),
    jsonb_build_object(
      'status',
      subscription.status,
      'cancel_at_period_end',
      subscription.cancel_at_period_end
    ),
    jsonb_build_object(
      'status',
      updated_subscription.status,
      'cancel_at_period_end',
      updated_subscription.cancel_at_period_end
    )
  );

  return updated_subscription;
end;
$$;

create or replace function public.reserve_takeoff_credits(
  p_job_id uuid,
  p_credits integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  account public.credit_accounts;
  existing_entry public.credit_ledger;
  next_status text;
begin
  if p_job_id is null then
    raise exception 'A takeoff job is required.';
  end if;

  if p_credits is null or p_credits <= 0 then
    raise exception 'Reserved credits must be a positive integer.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'An idempotency key is required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if job.status not in ('draft', 'awaiting_upload', 'ready', 'queued') then
    raise exception 'Takeoff job status % cannot reserve credits.', job.status;
  end if;

  if p_credits <> job.quoted_credits then
    raise exception 'Reserved credits must match the verified quote of %.',
      job.quoted_credits;
  end if;

  perform 1
  from public.profiles as profile
  where profile.id = job.user_id
    and profile.status = 'active'
  for update;

  if not found then
    raise exception 'The customer account is not active.';
  end if;

  insert into public.credit_accounts (user_id)
  values (job.user_id)
  on conflict (user_id) do nothing;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = job.user_id
  for update;

  select ledger.*
  into existing_entry
  from public.credit_ledger as ledger
  where ledger.job_id = job.id
    and ledger.entry_type = 'reservation';

  if existing_entry.id is not null then
    if existing_entry.amount <> -p_credits then
      raise exception 'This job already has a different credit reservation.';
    end if;

    return account;
  end if;

  if job.scope = 'first_verified'
     and exists (
       select 1
       from public.takeoff_jobs as other_job
       join public.credit_ledger as other_reservation
         on other_reservation.job_id = other_job.id
        and other_reservation.entry_type = 'reservation'
       where other_job.user_id = job.user_id
         and other_job.id <> job.id
         and other_job.free_sample is false
         and other_job.scope = 'first_verified'
         and not exists (
           select 1
           from public.credit_ledger as other_release
           where other_release.job_id = other_job.id
             and other_release.entry_type = 'release'
         )
     ) then
    raise exception 'The first verified takeoff price has already been claimed.';
  end if;

  if account.balance < p_credits then
    raise exception 'Insufficient credits: required %, available %.',
      p_credits,
      account.balance;
  end if;

  insert into public.credit_ledger (
    user_id,
    job_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    metadata
  )
  values (
    job.user_id,
    job.id,
    'reservation',
    -p_credits,
    'takeoff_job',
    job.id::text,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('credits_reserved', p_credits)
  );

  update public.credit_accounts as credit_account
  set
    balance = credit_account.balance - p_credits,
    version = credit_account.version + 1
  where credit_account.user_id = job.user_id
  returning credit_account.* into account;

  next_status := case when job.status = 'queued' then job.status else 'queued' end;

  update public.takeoff_jobs
  set
    status = next_status,
    quoted_credits = greatest(quoted_credits, p_credits),
    reserved_credits = p_credits,
    queued_at = coalesce(queued_at, now())
  where id = job.id;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    metadata
  )
  values (
    job.id,
    job.user_id,
    'credits_reserved',
    job.status,
    next_status,
    'service',
    jsonb_build_object('credits', p_credits)
  );

  return account;
end;
$$;

create or replace function public.settle_takeoff_credits(
  p_job_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  account public.credit_accounts;
  reservation public.credit_ledger;
  existing_settlement public.credit_ledger;
  consumed integer;
begin
  if p_job_id is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A takeoff job and idempotency key are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = job.user_id
  for update;

  if account.user_id is null then
    raise exception 'Credit account not found.';
  end if;

  select ledger.*
  into reservation
  from public.credit_ledger as ledger
  where ledger.job_id = job.id
    and ledger.entry_type = 'reservation';

  if reservation.id is null then
    raise exception 'No credit reservation exists for this job.';
  end if;

  select ledger.*
  into existing_settlement
  from public.credit_ledger as ledger
  where ledger.job_id = job.id
    and ledger.entry_type = 'settlement';

  if existing_settlement.id is not null then
    return account;
  end if;

  if exists (
    select 1
    from public.credit_ledger as ledger
    where ledger.job_id = job.id
      and ledger.entry_type = 'release'
  ) then
    raise exception 'Released credits cannot be settled.';
  end if;

  consumed := abs(reservation.amount);

  insert into public.credit_ledger (
    user_id,
    job_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    metadata
  )
  values (
    job.user_id,
    job.id,
    'settlement',
    0,
    'takeoff_job',
    job.id::text,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('credits_consumed', consumed)
  );

  update public.credit_accounts as credit_account
  set
    lifetime_consumed = credit_account.lifetime_consumed + consumed,
    version = credit_account.version + 1
  where credit_account.user_id = job.user_id
  returning credit_account.* into account;

  update public.takeoff_jobs
  set consumed_credits = consumed
  where id = job.id;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    metadata
  )
  values (
    job.id,
    job.user_id,
    'credits_settled',
    job.status,
    job.status,
    'service',
    jsonb_build_object('credits', consumed)
  );

  return account;
end;
$$;

create or replace function public.release_takeoff_credits(
  p_job_id uuid,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  account public.credit_accounts;
  reservation public.credit_ledger;
  existing_release public.credit_ledger;
  released integer;
begin
  if p_job_id is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A takeoff job and idempotency key are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  select credit_account.*
  into account
  from public.credit_accounts as credit_account
  where credit_account.user_id = job.user_id
  for update;

  if account.user_id is null then
    raise exception 'Credit account not found.';
  end if;

  select ledger.*
  into reservation
  from public.credit_ledger as ledger
  where ledger.job_id = job.id
    and ledger.entry_type = 'reservation';

  if reservation.id is null then
    raise exception 'No credit reservation exists for this job.';
  end if;

  select ledger.*
  into existing_release
  from public.credit_ledger as ledger
  where ledger.job_id = job.id
    and ledger.entry_type = 'release';

  if existing_release.id is not null then
    return account;
  end if;

  if exists (
    select 1
    from public.credit_ledger as ledger
    where ledger.job_id = job.id
      and ledger.entry_type = 'settlement'
  ) then
    raise exception 'Settled credits cannot be released.';
  end if;

  released := abs(reservation.amount);

  insert into public.credit_ledger (
    user_id,
    job_id,
    entry_type,
    amount,
    source_type,
    source_id,
    idempotency_key,
    metadata
  )
  values (
    job.user_id,
    job.id,
    'release',
    released,
    'takeoff_job',
    job.id::text,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('credits_released', released)
  );

  update public.credit_accounts as credit_account
  set
    balance = credit_account.balance + released,
    version = credit_account.version + 1
  where credit_account.user_id = job.user_id
  returning credit_account.* into account;

  update public.takeoff_jobs
  set consumed_credits = 0
  where id = job.id;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    metadata
  )
  values (
    job.id,
    job.user_id,
    'credits_released',
    job.status,
    job.status,
    'service',
    jsonb_build_object('credits', released)
  );

  return account;
end;
$$;

create or replace function public.complete_takeoff_job(
  p_job_id uuid,
  p_worker_id text,
  p_claim_token uuid,
  p_idempotency_key text,
  p_result_summary jsonb default '{}'::jsonb
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  completed public.takeoff_jobs;
  completion_time timestamptz;
begin
  if p_job_id is null
     or nullif(btrim(p_worker_id), '') is null
     or p_claim_token is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A takeoff job, worker claim, and idempotency key are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if job.claimed_by is distinct from p_worker_id then
    raise exception 'This worker does not own the takeoff claim.';
  end if;
  if job.claim_token is distinct from p_claim_token then
    raise exception 'The takeoff claim token is no longer current.';
  end if;

  if job.status = 'completed' then
    return job;
  end if;

  if job.status <> 'processing' then
    raise exception 'Takeoff job status % cannot be completed.', job.status;
  end if;

  if not exists (
    select 1
    from public.takeoff_files as file
    where file.job_id = job.id
      and file.file_role = 'result'
      and file.original_filename = 'annotated_drawings.pdf'
      and file.storage_path =
        job.user_id::text || '/' || job.id::text || '/results/'
        || job.claim_token::text || '/annotated_drawings.pdf'
      and file.verified_at is not null
  ) or not exists (
    select 1
    from public.takeoff_files as file
    where file.job_id = job.id
      and file.file_role = 'result'
      and file.original_filename = 'takeoff.xlsx'
      and file.storage_path =
        job.user_id::text || '/' || job.id::text || '/results/'
        || job.claim_token::text || '/takeoff.xlsx'
      and file.verified_at is not null
  ) then
    raise exception 'The verified marked PDF and workbook are required.';
  end if;

  if job.reserved_credits > 0 then
    perform public.settle_takeoff_credits(
      job.id,
      p_idempotency_key,
      jsonb_build_object(
        'completed_by',
        p_worker_id,
        'delivery_mode',
        'self_serve'
      )
    );
  end if;

  completion_time := now();
  update public.takeoff_jobs as takeoff_job
  set
    status = 'completed',
    progress = 100,
    stage = 'delivered',
    completed_at = completion_time,
    result_summary = coalesce(takeoff_job.result_summary, '{}'::jsonb)
      || coalesce(p_result_summary, '{}'::jsonb)
      || jsonb_build_object('delivery_mode', 'self_serve')
  where takeoff_job.id = job.id
    and takeoff_job.status = 'processing'
    and takeoff_job.claimed_by = p_worker_id
    and takeoff_job.claim_token = p_claim_token
  returning takeoff_job.* into completed;

  if completed.id is null then
    raise exception 'The takeoff terminal transition lost its claim.';
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    message,
    metadata
  )
  values (
    completed.id,
    completed.user_id,
    'automation_completed',
    'processing',
    'completed',
    'service',
    'Automated measurement completed and deliverables were released.',
    coalesce(p_result_summary, '{}'::jsonb)
      || jsonb_build_object(
        'delivery_mode',
        'self_serve',
        'completed_at',
        completion_time
      )
  );

  insert into public.analytics_events (
    user_id,
    job_id,
    event_name,
    source,
    metadata
  )
  values (
    completed.user_id,
    completed.id,
    'takeoff_delivered',
    'worker',
    coalesce(p_result_summary, '{}'::jsonb)
      || jsonb_build_object(
        'credits',
        completed.reserved_credits,
        'delivery_mode',
        'self_serve'
      )
  );

  return completed;
end;
$$;

create or replace function public.fail_takeoff_job(
  p_job_id uuid,
  p_worker_id text,
  p_claim_token uuid,
  p_stage text,
  p_message text,
  p_retryable boolean,
  p_force_terminal boolean,
  p_idempotency_key text,
  p_stale_before timestamptz
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  transitioned public.takeoff_jobs;
  should_retry boolean;
  next_failure_code text;
begin
  if p_job_id is null
     or p_claim_token is null
     or nullif(btrim(p_stage), '') is null
     or nullif(btrim(p_message), '') is null
     or p_retryable is null
     or p_force_terminal is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'Complete takeoff failure details are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if job.status = 'failed' then
    return job;
  end if;

  if job.status <> 'processing' then
    raise exception 'Takeoff job status % cannot accept a processing failure.',
      job.status;
  end if;

  if p_worker_id is not null
     and job.claimed_by is distinct from p_worker_id then
    raise exception 'This worker does not own the takeoff claim.';
  end if;
  if job.claim_token is distinct from p_claim_token then
    raise exception 'The takeoff claim token is no longer current.';
  end if;

  -- Reconciliation is compare-and-set under the row lock. A heartbeat that
  -- landed after the candidate query keeps the active claim intact.
  if p_stale_before is not null and job.updated_at >= p_stale_before then
    return job;
  end if;

  should_retry :=
    p_retryable
    and not p_force_terminal
    and job.attempt_count < job.max_attempts;
  next_failure_code := case
    when should_retry then 'worker_retryable'
    when p_stage = 'stale_claim_exhausted' then 'stale_claim_exhausted'
    else 'worker_terminal'
  end;

  if should_retry then
    update public.takeoff_jobs as takeoff_job
    set
      status = 'queued',
      progress = 20,
      stage = 'retry_queued',
      claimed_by = null,
      claim_token = null,
      claimed_at = null,
      processor_job_id = null,
      queued_at = now(),
      failure_code = next_failure_code,
      failure_message = left(p_message, 2000)
    where takeoff_job.id = job.id
      and takeoff_job.status = 'processing'
    returning takeoff_job.* into transitioned;

    insert into public.takeoff_job_events (
      job_id,
      user_id,
      event_type,
      from_status,
      to_status,
      actor_type,
      message,
      metadata
    )
    values (
      transitioned.id,
      transitioned.user_id,
      'processing_retry_queued',
      'processing',
      'queued',
      case when p_worker_id is null then 'system' else 'service' end,
      'A retryable processing failure was queued for another attempt.',
      jsonb_build_object(
        'stage',
        p_stage,
        'attempt_count',
        transitioned.attempt_count,
        'max_attempts',
        transitioned.max_attempts
      )
    );

    return transitioned;
  end if;

  if job.reserved_credits > 0 and job.consumed_credits = 0 then
    perform public.release_takeoff_credits(
      job.id,
      p_idempotency_key,
      jsonb_build_object(
        'stage',
        p_stage,
        'retryable',
        p_retryable,
        'force_terminal',
        p_force_terminal
      )
    );
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'failed',
    progress = 0,
    stage = p_stage,
    failed_at = now(),
    failure_code = next_failure_code,
    failure_message = left(p_message, 2000),
    claimed_by = null,
    claim_token = null,
    claimed_at = null
  where takeoff_job.id = job.id
    and takeoff_job.status = 'processing'
  returning takeoff_job.* into transitioned;

  if transitioned.id is null then
    raise exception 'The takeoff terminal transition lost its claim.';
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    message,
    metadata
  )
  values (
    transitioned.id,
    transitioned.user_id,
    'processing_failed',
    'processing',
    'failed',
    case when p_worker_id is null then 'system' else 'service' end,
    'Processing failed after its available attempts. Reserved credits were released.',
    jsonb_build_object(
      'stage',
      p_stage,
      'retryable',
      p_retryable,
      'attempt_count',
      transitioned.attempt_count,
      'max_attempts',
      transitioned.max_attempts
    )
  );

  insert into public.admin_alerts (
    severity,
    category,
    title,
    message,
    status,
    dedupe_key,
    entity_type,
    entity_id,
    user_id,
    job_id,
    metadata
  )
  values (
    'critical',
    'worker',
    'Takeoff processing failed',
    left(p_message, 2000),
    'open',
    'worker-terminal:' || transitioned.id::text,
    'takeoff_job',
    transitioned.id::text,
    transitioned.user_id,
    transitioned.id,
    jsonb_build_object(
      'stage',
      p_stage,
      'retryable',
      p_retryable,
      'attempt_count',
      transitioned.attempt_count
    )
  )
  on conflict (dedupe_key)
  where dedupe_key is not null
    and status in ('open', 'acknowledged')
  do update set
    message = excluded.message,
    status = 'open',
    occurrence_count = public.admin_alerts.occurrence_count + 1,
    last_seen_at = now(),
    metadata = excluded.metadata;

  return transitioned;
end;
$$;

create or replace function public.queue_free_sample(
  p_job_id uuid,
  p_idempotency_key text
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  customer public.profiles;
  queued public.takeoff_jobs;
  sample_claimed_at timestamptz;
begin
  if p_job_id is null
     or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A takeoff job and idempotency key are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  select profile.*
  into customer
  from public.profiles as profile
  where profile.id = job.user_id
  for update;

  if customer.id is null then
    raise exception 'Customer profile not found.';
  end if;

  if customer.status <> 'active' then
    raise exception 'The customer account is not active.';
  end if;

  if job.free_sample is not true then
    raise exception 'The takeoff job is not marked as a free sample.';
  end if;

  if job.quoted_credits <> 0 then
    raise exception 'Free samples must quote zero credits.';
  end if;

  if customer.free_sample_used_at is not null then
    if job.status in ('queued', 'processing', 'needs_review', 'completed')
       and exists (
         select 1
         from public.takeoff_job_events as event
         where event.job_id = job.id
           and event.user_id = job.user_id
           and event.event_type = 'free_sample_queued'
       ) then
      return job;
    end if;

    raise exception 'The customer has already used the free sample.';
  end if;

  if job.status <> 'ready' then
    raise exception 'Free sample job status % cannot be queued.', job.status;
  end if;

  sample_claimed_at := now();

  update public.profiles
  set free_sample_used_at = sample_claimed_at
  where id = customer.id;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'queued',
    stage = 'queued',
    progress = greatest(takeoff_job.progress, 5),
    queued_at = coalesce(takeoff_job.queued_at, sample_claimed_at),
    due_at = coalesce(takeoff_job.due_at, sample_claimed_at + interval '8 hours')
  where takeoff_job.id = job.id
  returning takeoff_job.* into queued;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    message,
    metadata
  )
  values (
    queued.id,
    queued.user_id,
    'free_sample_queued',
    job.status,
    queued.status,
    'service',
    'Free accuracy sample queued for processing.',
    jsonb_build_object(
      'idempotency_key',
      p_idempotency_key,
      'due_at',
      queued.due_at
    )
  );

  return queued;
end;
$$;

create or replace function public.claim_takeoff_job(
  p_job_id uuid,
  p_worker_id text
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.takeoff_jobs;
begin
  if p_job_id is null
     or nullif(btrim(p_worker_id), '') is null then
    raise exception 'A takeoff job and worker ID are required.';
  end if;

  update public.takeoff_jobs
  set
    status = 'processing',
    claimed_by = p_worker_id,
    claim_token = gen_random_uuid(),
    claimed_at = now(),
    processing_started_at = coalesce(processing_started_at, now()),
    attempt_count = attempt_count + 1
  where id = p_job_id
    and status = 'queued'
    and claimed_by is null
    and attempt_count < max_attempts
  returning * into claimed;

  if claimed.id is not null then
    insert into public.takeoff_job_events (
      job_id,
      user_id,
      event_type,
      from_status,
      to_status,
      actor_type,
      message,
      metadata
    )
    values (
      claimed.id,
      claimed.user_id,
      'job_claimed',
      'queued',
      'processing',
      'service',
      'Takeoff job claimed by processor.',
      jsonb_build_object('worker_id', p_worker_id)
    );
  end if;

  return claimed;
end;
$$;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_time timestamptz := clock_timestamp();
  rate_window interval;
  bucket public.api_rate_limits;
  retry_after_seconds integer;
begin
  if nullif(btrim(p_bucket_key), '') is null
     or char_length(p_bucket_key) > 200 then
    raise exception 'A valid rate-limit bucket key is required.';
  end if;

  if p_limit < 1 or p_limit > 10000 then
    raise exception 'The rate-limit request count is invalid.';
  end if;

  if p_window_seconds < 1 or p_window_seconds > 604800 then
    raise exception 'The rate-limit window is invalid.';
  end if;

  rate_window := pg_catalog.make_interval(secs => p_window_seconds);

  insert into public.api_rate_limits (
    bucket_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (
    btrim(p_bucket_key),
    current_time,
    1,
    current_time
  )
  on conflict (bucket_key)
  do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at
        <= current_time - rate_window
        then current_time
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at
        <= current_time - rate_window
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = current_time
  returning * into bucket;

  retry_after_seconds := greatest(
    0,
    ceil(
      extract(
        epoch from (
          bucket.window_started_at + rate_window - current_time
        )
      )
    )::integer
  );

  return jsonb_build_object(
    'allowed',
    bucket.request_count <= p_limit,
    'remaining',
    greatest(0, p_limit - bucket.request_count),
    'retry_after_seconds',
    retry_after_seconds
  );
end;
$$;

create or replace function public.expire_abandoned_takeoff_job(
  p_job_id uuid,
  p_cutoff timestamptz
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  expired_job public.takeoff_jobs;
begin
  if p_job_id is null or p_cutoff is null then
    raise exception 'A takeoff job and expiration cutoff are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
  for update;

  if job.id is null
     or job.status not in ('awaiting_upload', 'ready')
     or job.created_at >= p_cutoff then
    return null;
  end if;

  if job.reserved_credits <> 0 or job.consumed_credits <> 0 then
    raise exception 'A funded takeoff cannot be expired as an abandoned upload.';
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'canceled',
    stage = 'upload_expired',
    progress = 0,
    failure_code = 'upload_expired',
    failure_message =
      'The upload session expired before the takeoff was queued.',
    verification_token = null,
    verification_started_at = null
  where takeoff_job.id = job.id
    and takeoff_job.status = job.status
  returning takeoff_job.* into expired_job;

  if expired_job.id is null then
    return null;
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    message,
    metadata
  )
  values (
    expired_job.id,
    expired_job.user_id,
    'upload_expired',
    job.status,
    expired_job.status,
    'system',
    'The unqueued upload session expired and its private source file was scheduled for deletion.',
    jsonb_build_object('cutoff', p_cutoff)
  );

  insert into public.analytics_events (
    user_id,
    job_id,
    event_name,
    source,
    metadata
  )
  values (
    expired_job.user_id,
    expired_job.id,
    'takeoff_upload_expired',
    'system',
    jsonb_build_object('previous_status', job.status)
  );

  return expired_job;
end;
$$;

create or replace function public.begin_takeoff_verification(
  p_job_id uuid,
  p_user_id uuid
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  claimed public.takeoff_jobs;
begin
  if p_job_id is null or p_user_id is null then
    raise exception 'A takeoff job and customer are required.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
    and takeoff_job.user_id = p_user_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if job.status <> 'awaiting_upload' then
    raise exception 'Only an uploaded, unverified takeoff can be verified.';
  end if;

  if job.verification_token is not null
     and job.verification_started_at > now() - interval '15 minutes' then
    raise exception 'This takeoff is already being verified.';
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    verification_token = gen_random_uuid(),
    verification_started_at = now(),
    stage = 'verifying_plan'
  where takeoff_job.id = job.id
    and takeoff_job.status = 'awaiting_upload'
  returning takeoff_job.* into claimed;

  if claimed.id is null then
    raise exception 'The takeoff verification claim was lost.';
  end if;

  return claimed;
end;
$$;

create or replace function public.release_takeoff_verification(
  p_job_id uuid,
  p_user_id uuid,
  p_verification_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  released_id uuid;
begin
  if p_job_id is null
     or p_user_id is null
     or p_verification_token is null then
    return false;
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    verification_token = null,
    verification_started_at = null,
    stage = 'awaiting_upload'
  where takeoff_job.id = p_job_id
    and takeoff_job.user_id = p_user_id
    and takeoff_job.status = 'awaiting_upload'
    and takeoff_job.verification_token = p_verification_token
  returning takeoff_job.id into released_id;

  return released_id is not null;
end;
$$;

create or replace function public.finalize_takeoff_verification(
  p_job_id uuid,
  p_user_id uuid,
  p_verification_token uuid,
  p_file_id uuid,
  p_storage_path text,
  p_size_bytes bigint,
  p_sha256 text,
  p_original_page_count integer,
  p_page_count integer,
  p_sample_page integer,
  p_scope text,
  p_quoted_credits integer,
  p_due_at timestamptz,
  p_result_summary jsonb
)
returns public.takeoff_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  source_file public.takeoff_files;
  ready_job public.takeoff_jobs;
  required_prefix text;
begin
  if p_job_id is null
     or p_user_id is null
     or p_verification_token is null
     or p_file_id is null then
    raise exception 'The verification claim and source file are required.';
  end if;

  if nullif(btrim(p_storage_path), '') is null
     or p_size_bytes < 5
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_original_page_count < 1
     or p_page_count < 1
     or p_quoted_credits < 0
     or jsonb_typeof(coalesce(p_result_summary, '{}'::jsonb)) <> 'object'
     or p_scope not in (
       'free_sample',
       'first_verified',
       'essential',
       'professional',
       'multi_trade',
       'large_set'
     ) then
    raise exception 'The verified plan metadata is invalid.';
  end if;

  select takeoff_job.*
  into job
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
    and takeoff_job.user_id = p_user_id
  for update;

  if job.id is null then
    raise exception 'Takeoff job not found.';
  end if;

  if job.status <> 'awaiting_upload'
     or job.verification_token <> p_verification_token then
    raise exception 'The takeoff verification claim is no longer active.';
  end if;

  select takeoff_file.*
  into source_file
  from public.takeoff_files as takeoff_file
  where takeoff_file.id = p_file_id
    and takeoff_file.job_id = job.id
    and takeoff_file.user_id = job.user_id
    and takeoff_file.file_role = 'input'
    and takeoff_file.bucket = 'takeoff-uploads'
  for update;

  if source_file.id is null then
    raise exception 'The takeoff source file is missing.';
  end if;

  required_prefix := job.user_id::text || '/' || job.id::text || '/';
  if left(p_storage_path, char_length(required_prefix)) <> required_prefix then
    raise exception 'The verified source path is outside the takeoff namespace.';
  end if;

  if job.free_sample then
    if p_scope <> 'free_sample'
       or p_quoted_credits <> 0
       or p_page_count <> 1
       or p_sample_page is null
       or p_sample_page > p_original_page_count then
      raise exception 'The free-sample verification metadata is inconsistent.';
    end if;
  elsif p_sample_page is not null or p_scope = 'free_sample' then
    raise exception 'A paid takeoff cannot use free-sample verification metadata.';
  end if;

  update public.takeoff_files as takeoff_file
  set
    storage_path = p_storage_path,
    mime_type = 'application/pdf',
    size_bytes = p_size_bytes,
    sha256 = p_sha256,
    page_count = p_page_count,
    verified_at = now()
  where takeoff_file.id = source_file.id;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'ready',
    scope = p_scope,
    input_page_count = p_page_count,
    sample_page = p_sample_page,
    quoted_credits = p_quoted_credits,
    progress = 10,
    stage = 'plan_verified',
    due_at = p_due_at,
    result_summary =
      coalesce(takeoff_job.result_summary, '{}'::jsonb)
      || coalesce(p_result_summary, '{}'::jsonb),
    verification_token = null,
    verification_started_at = null
  where takeoff_job.id = job.id
    and takeoff_job.status = 'awaiting_upload'
    and takeoff_job.verification_token = p_verification_token
  returning takeoff_job.* into ready_job;

  if ready_job.id is null then
    raise exception 'The takeoff verification claim was lost.';
  end if;

  insert into public.takeoff_job_events (
    job_id,
    user_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    message,
    metadata
  )
  values (
    ready_job.id,
    ready_job.user_id,
    'plan_verified',
    job.status,
    ready_job.status,
    'service',
    'Plan object, PDF signature, page count, and fixed quote verified.',
    jsonb_build_object(
      'original_page_count',
      p_original_page_count,
      'page_count',
      p_page_count,
      'sha256',
      p_sha256,
      'pricing_tier',
      p_scope
    )
  );

  insert into public.analytics_events (
    user_id,
    job_id,
    event_name,
    source,
    metadata
  )
  values (
    ready_job.user_id,
    ready_job.id,
    'takeoff_quote_ready',
    'product',
    jsonb_build_object(
      'tier',
      p_scope,
      'credits',
      p_quoted_credits,
      'pages',
      p_page_count
    )
  );

  return ready_job;
end;
$$;

revoke execute on function public.grant_credits(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function public.grant_credits(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

revoke execute on function public.reverse_credit_grant(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.reverse_credit_grant(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke execute on function public.fulfill_stripe_credit_grant(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function public.fulfill_stripe_credit_grant(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) to service_role;

revoke execute on function public.record_stripe_credit_refund(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.record_stripe_credit_refund(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) to service_role;

revoke execute on function public.admin_sync_billing_catalog(
  jsonb,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.admin_sync_billing_catalog(
  jsonb,
  uuid,
  text
) to service_role;

revoke execute on function public.admin_adjust_credits(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.admin_adjust_credits(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
) to service_role;

revoke execute on function public.admin_set_profile_status(
  uuid,
  text,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.admin_set_profile_status(
  uuid,
  text,
  uuid,
  text,
  text,
  jsonb
) to service_role;

revoke execute on function public.request_takeoff_correction(
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.request_takeoff_correction(
  uuid,
  uuid,
  text
) to service_role;

revoke execute on function public.admin_resolve_takeoff(
  uuid,
  text,
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.admin_resolve_takeoff(
  uuid,
  text,
  text,
  uuid,
  text
) to service_role;

revoke execute on function public.admin_schedule_subscription_cancel(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.admin_schedule_subscription_cancel(
  uuid,
  uuid,
  text,
  text
) to service_role;

revoke execute on function public.reserve_takeoff_credits(
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.reserve_takeoff_credits(
  uuid,
  integer,
  text,
  jsonb
) to service_role;

revoke execute on function public.settle_takeoff_credits(
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.settle_takeoff_credits(
  uuid,
  text,
  jsonb
) to service_role;

revoke execute on function public.release_takeoff_credits(
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.release_takeoff_credits(
  uuid,
  text,
  jsonb
) to service_role;

revoke execute on function public.complete_takeoff_job(
  uuid,
  text,
  uuid,
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.complete_takeoff_job(
  uuid,
  text,
  uuid,
  text,
  jsonb
) to service_role;

revoke execute on function public.fail_takeoff_job(
  uuid,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.fail_takeoff_job(
  uuid,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  text,
  timestamptz
) to service_role;

revoke execute on function public.queue_free_sample(uuid, text)
  from public, anon, authenticated;
grant execute on function public.queue_free_sample(uuid, text)
  to service_role;

revoke execute on function public.claim_takeoff_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_takeoff_job(uuid, text)
  to service_role;

revoke execute on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

revoke execute on function public.expire_abandoned_takeoff_job(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_abandoned_takeoff_job(uuid, timestamptz)
  to service_role;

revoke execute on function public.begin_takeoff_verification(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_takeoff_verification(uuid, uuid)
  to service_role;

revoke execute on function public.release_takeoff_verification(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.release_takeoff_verification(uuid, uuid, uuid)
  to service_role;

revoke execute on function public.finalize_takeoff_verification(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  integer,
  timestamptz,
  jsonb
) from public, anon, authenticated;
grant execute on function public.finalize_takeoff_verification(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  bigint,
  text,
  integer,
  integer,
  integer,
  text,
  integer,
  timestamptz,
  jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- Uncapped, source-backed administration analytics
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_analytics_snapshot(
  p_as_of timestamptz default statement_timestamp()
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
bounds as (
  select
    p_as_of as as_of,
    p_as_of - interval '30 days' as current_30,
    p_as_of - interval '60 days' as previous_30
),
profile_stats as (
  select
    count(*)::bigint as total_users,
    count(*) filter (
      where profile.created_at >= bounds.current_30
        and profile.created_at < bounds.as_of
    )::bigint as new_users_30,
    count(*) filter (
      where profile.created_at >= bounds.previous_30
        and profile.created_at < bounds.current_30
    )::bigint as new_users_previous_30,
    count(*) filter (
      where profile.country_code is not null
    )::bigint as known_location_users,
    count(distinct profile.country_code) filter (
      where profile.country_code is not null
    )::bigint as countries,
    count(*) filter (
      where profile.country_code is null
    )::bigint as missing_country
  from public.profiles as profile
  cross join bounds
),
subscription_stats as (
  select
    count(*) filter (
      where subscription.status = 'active'
    )::bigint as active_subscriptions,
    count(*) filter (
      where subscription.canceled_at >= bounds.current_30
        and subscription.canceled_at < bounds.as_of
    )::bigint as cancellations_30,
    coalesce(
      sum(
        case
          when subscription.status <> 'active' then 0
          when plan.billing_interval = 'month' then plan.price_cents
          when plan.billing_interval = 'year'
            then round(plan.price_cents::numeric / 12)
          else 0
        end
      ),
      0
    )::bigint as mrr_cents,
    count(*) filter (
      where subscription.status = 'past_due'
    )::bigint as past_due_subscriptions
  from public.subscriptions as subscription
  left join public.billing_plans as plan
    on plan.id = subscription.billing_plan_id
  cross join bounds
),
cash_payment_candidates as (
  select
    'checkout'::text as source_type,
    stripe_event.payload #>> '{data,object,id}' as object_id,
    (stripe_event.payload #>> '{data,object,amount_total}')::bigint
      as amount_cents,
    lower(stripe_event.payload #>> '{data,object,currency}') as currency,
    null::text as billing_reason,
    coalesce(stripe_event.event_created_at, stripe_event.created_at)
      as paid_at,
    stripe_event.id as stripe_event_id
  from public.stripe_events as stripe_event
  where stripe_event.status = 'processed'
    and stripe_event.event_type in (
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded'
    )
    and stripe_event.payload #>> '{data,object,mode}' = 'payment'
    and stripe_event.payload #>> '{data,object,payment_status}' = 'paid'
    and coalesce(
      stripe_event.payload #>> '{data,object,amount_total}',
      ''
    ) ~ '^[0-9]+$'
    and stripe_event.payload #>> '{data,object,id}' is not null

  union all

  select
    'invoice'::text as source_type,
    stripe_event.payload #>> '{data,object,id}' as object_id,
    (stripe_event.payload #>> '{data,object,amount_paid}')::bigint
      as amount_cents,
    lower(stripe_event.payload #>> '{data,object,currency}') as currency,
    stripe_event.payload #>> '{data,object,billing_reason}'
      as billing_reason,
    coalesce(
      case
        when coalesce(
          stripe_event.payload
            #>> '{data,object,status_transitions,paid_at}',
          ''
        ) ~ '^[0-9]+$'
        then to_timestamp(
          (
            stripe_event.payload
              #>> '{data,object,status_transitions,paid_at}'
          )::double precision
        )
        else null
      end,
      stripe_event.event_created_at,
      stripe_event.created_at
    ) as paid_at,
    stripe_event.id as stripe_event_id
  from public.stripe_events as stripe_event
  where stripe_event.status = 'processed'
    and stripe_event.event_type = 'invoice.paid'
    and stripe_event.payload #>> '{data,object,status}' = 'paid'
    and stripe_event.payload #>> '{data,object,billing_reason}' in (
      'subscription_create',
      'subscription_cycle'
    )
    and coalesce(
      stripe_event.payload #>> '{data,object,amount_paid}',
      ''
    ) ~ '^[0-9]+$'
    and stripe_event.payload #>> '{data,object,id}' is not null
),
cash_payments as (
  select distinct on (
    candidate.source_type,
    candidate.object_id
  )
    candidate.source_type,
    candidate.object_id,
    candidate.amount_cents,
    candidate.currency,
    candidate.billing_reason,
    candidate.paid_at
  from cash_payment_candidates as candidate
  order by
    candidate.source_type,
    candidate.object_id,
    candidate.paid_at desc,
    candidate.stripe_event_id desc
),
refund_candidates as (
  select
    stripe_event.payload #>> '{data,object,id}' as refund_id,
    stripe_event.payload #>> '{data,object,status}' as refund_status,
    coalesce(stripe_event.event_created_at, stripe_event.created_at)
      as observed_at,
    stripe_event.id as stripe_event_id
  from public.stripe_events as stripe_event
  where stripe_event.status = 'processed'
    and stripe_event.event_type in ('refund.created', 'refund.updated')
    and stripe_event.payload #>> '{data,object,id}' is not null
),
latest_refunds as (
  select distinct on (candidate.refund_id)
    candidate.refund_id,
    candidate.refund_status,
    candidate.observed_at
  from refund_candidates as candidate
  order by
    candidate.refund_id,
    candidate.observed_at desc,
    candidate.stripe_event_id desc
),
cash_stats as (
  select
    coalesce(
      sum(payment.amount_cents) filter (
        where payment.currency = 'usd'
          and payment.paid_at >= bounds.current_30
          and payment.paid_at < bounds.as_of
      ),
      0
    )::bigint as revenue_30_cents,
    count(*) filter (
      where payment.source_type = 'invoice'
        and payment.billing_reason = 'subscription_create'
        and payment.currency = 'usd'
        and payment.paid_at >= bounds.current_30
        and payment.paid_at < bounds.as_of
    )::bigint as paid_subscription_starts_30
  from cash_payments as payment
  cross join bounds
),
refund_stats as (
  select
    count(*) filter (
      where refund.refund_status = 'succeeded'
        and refund.observed_at >= bounds.current_30
        and refund.observed_at < bounds.as_of
    )::bigint as refunds_30
  from latest_refunds as refund
  cross join bounds
),
job_stats as (
  select
    count(*) filter (
      where takeoff_job.created_at >= bounds.current_30
        and takeoff_job.created_at < bounds.as_of
    )::bigint as jobs_30,
    coalesce(
      sum(takeoff_job.input_page_count) filter (
        where takeoff_job.created_at >= bounds.current_30
          and takeoff_job.created_at < bounds.as_of
      ),
      0
    )::bigint as pages_30,
    count(*) filter (
      where takeoff_job.status = 'processing'
        and takeoff_job.updated_at < bounds.as_of - interval '30 minutes'
    )::bigint as stale_processing
  from public.takeoff_jobs as takeoff_job
  cross join bounds
),
quality_stats as (
  select
    count(*) filter (
      where takeoff_job.completed_at >= bounds.current_30
        and takeoff_job.completed_at < bounds.as_of
    )::bigint as completed_jobs_30,
    count(*) filter (
      where takeoff_job.failed_at >= bounds.current_30
        and takeoff_job.failed_at < bounds.as_of
        and takeoff_job.status = 'failed'
    )::bigint as failed_jobs_30,
    count(*) filter (
      where takeoff_job.completed_at >= bounds.current_30
        and takeoff_job.completed_at < bounds.as_of
        and takeoff_job.due_at is not null
    )::bigint as on_time_eligible_30,
    count(*) filter (
      where takeoff_job.completed_at >= bounds.current_30
        and takeoff_job.completed_at < bounds.as_of
        and takeoff_job.due_at is not null
        and takeoff_job.completed_at <= takeoff_job.due_at
    )::bigint as on_time_jobs_30
  from public.takeoff_jobs as takeoff_job
  cross join bounds
),
delivered_30 as (
  select
    analytics_event.job_id,
    min(analytics_event.occurred_at) as delivered_at
  from public.analytics_events as analytics_event
  cross join bounds
  where analytics_event.event_name = 'takeoff_delivered'
    and analytics_event.job_id is not null
    and analytics_event.occurred_at >= bounds.current_30
    and analytics_event.occurred_at < bounds.as_of
  group by analytics_event.job_id
),
correction_stats as (
  select
    count(*)::bigint as delivered_jobs_30,
    count(*) filter (
      where exists (
        select 1
        from public.takeoff_job_events as correction_event
        where correction_event.job_id = delivered.job_id
          and correction_event.event_type = 'correction_requested'
          and correction_event.created_at >= delivered.delivered_at
      )
    )::bigint as corrected_jobs_30
  from delivered_30 as delivered
),
annotation_values as (
  select
    case
      when coalesce(
        takeoff_job.result_summary #>> '{metrics,counted_units}',
        ''
      ) ~ '^[0-9]+$'
      then (
        takeoff_job.result_summary #>> '{metrics,counted_units}'
      )::bigint
      else 0
    end as counted_units,
    case
      when coalesce(
        takeoff_job.result_summary #>> '{metrics,skipped_annotations}',
        ''
      ) ~ '^[0-9]+$'
      then (
        takeoff_job.result_summary #>> '{metrics,skipped_annotations}'
      )::bigint
      else 0
    end as skipped_annotations
  from public.takeoff_jobs as takeoff_job
  cross join bounds
  where takeoff_job.completed_at >= bounds.current_30
    and takeoff_job.completed_at < bounds.as_of
),
annotation_stats as (
  select
    coalesce(sum(annotation.counted_units), 0)::bigint
      as counted_units_30,
    coalesce(sum(annotation.skipped_annotations), 0)::bigint
      as skipped_annotations_30
  from annotation_values as annotation
),
credit_stats as (
  select
    coalesce(sum(account.balance), 0)::bigint as available_credits,
    coalesce(sum(account.lifetime_consumed), 0)::bigint
      as consumed_credits
  from public.credit_accounts as account
),
confirmed_job_counts as (
  select
    takeoff_job.user_id,
    count(*)::bigint as confirmed_jobs
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.status in (
    'queued',
    'processing',
    'needs_review',
    'completed',
    'failed'
  )
  group by takeoff_job.user_id
),
repeat_stats as (
  select
    count(*)::bigint as companies_with_confirmed_jobs,
    count(*) filter (
      where confirmed.confirmed_jobs > 1
    )::bigint as repeat_companies
  from confirmed_job_counts as confirmed
),
catalog_stats as (
  select
    count(*) filter (
      where plan.active
        and plan.stripe_price_id is null
    )::bigint as unpriced_plans
  from public.billing_plans as plan
),
stripe_processing_stats as (
  select
    count(*) filter (
      where stripe_event.status = 'failed'
        or (
          stripe_event.status in ('received', 'processing')
          and stripe_event.updated_at < bounds.as_of - interval '10 minutes'
        )
    )::bigint as failed_stripe_events
  from public.stripe_events as stripe_event
  cross join bounds
),
geography_rows as (
  select
    profile.country_code
      || ' · '
      || coalesce(nullif(btrim(profile.region), ''), 'Unspecified')
      as label,
    count(*)::bigint as users
  from public.profiles as profile
  where profile.country_code is not null
  group by
    profile.country_code,
    coalesce(nullif(btrim(profile.region), ''), 'Unspecified')
),
status_dimension(status, sort_order) as (
  values
    ('draft'::text, 0),
    ('awaiting_upload'::text, 1),
    ('ready'::text, 2),
    ('queued'::text, 3),
    ('processing'::text, 4),
    ('needs_review'::text, 5),
    ('completed'::text, 6),
    ('failed'::text, 7),
    ('canceled'::text, 8)
),
status_rows as (
  select
    status_dimension.status,
    status_dimension.sort_order,
    count(takeoff_job.id)::bigint as count
  from status_dimension
  left join public.takeoff_jobs as takeoff_job
    on takeoff_job.status = status_dimension.status
  group by status_dimension.status, status_dimension.sort_order
),
funnel_dimension(name, sort_order) as (
  values
    ('takeoff_draft_created'::text, 1),
    ('takeoff_quote_ready'::text, 2),
    ('takeoff_queued'::text, 3),
    ('takeoff_automation_completed'::text, 4),
    ('takeoff_delivered'::text, 5)
),
funnel_cohort as (
  select takeoff_job.id
  from public.takeoff_jobs as takeoff_job
  cross join bounds
  where takeoff_job.created_at >= bounds.current_30
    and takeoff_job.created_at < bounds.as_of
),
funnel_events as (
  select
    analytics_event.job_id,
    analytics_event.event_name as name
  from public.analytics_events as analytics_event
  cross join bounds
  where analytics_event.job_id is not null
    and analytics_event.occurred_at < bounds.as_of
    and analytics_event.event_name in (
      'takeoff_draft_created',
      'takeoff_quote_ready',
      'takeoff_queued',
      'takeoff_delivered'
    )

  union

  select
    job_event.job_id,
    'takeoff_automation_completed'::text as name
  from public.takeoff_job_events as job_event
  cross join bounds
  where job_event.event_type = 'automation_completed'
    and job_event.created_at < bounds.as_of
),
funnel_rows as (
  select
    funnel_dimension.name,
    funnel_dimension.sort_order,
    count(distinct cohort.id)::bigint as count
  from funnel_dimension
  left join funnel_events as funnel_event
    on funnel_event.name = funnel_dimension.name
  left join funnel_cohort as cohort
    on cohort.id = funnel_event.job_id
  group by funnel_dimension.name, funnel_dimension.sort_order
),
week_dimension as (
  select
    date_trunc('week', bounds.as_of)
      - (week_offset.week_index * interval '1 week') as week_start
  from bounds
  cross join generate_series(7, 0, -1) as week_offset(week_index)
),
week_rows as (
  select
    week.week_start,
    count(takeoff_job.id)::bigint as jobs,
    coalesce(sum(takeoff_job.input_page_count), 0)::bigint as pages
  from week_dimension as week
  left join public.takeoff_jobs as takeoff_job
    on takeoff_job.created_at >= week.week_start
    and takeoff_job.created_at < week.week_start + interval '1 week'
  group by week.week_start
)
select jsonb_build_object(
  'asOf',
  bounds.as_of,
  'currency',
  'usd',
  'metrics',
  jsonb_build_object(
    'totalUsers',
    profile_stats.total_users,
    'newUsers30',
    profile_stats.new_users_30,
    'userGrowthPct',
    case
      when profile_stats.new_users_previous_30 = 0
        then case when profile_stats.new_users_30 > 0 then 100 else 0 end
      else round(
        (
          profile_stats.new_users_30
          - profile_stats.new_users_previous_30
        )::numeric
        * 100
        / profile_stats.new_users_previous_30,
        2
      )
    end,
    'activeSubscriptions',
    subscription_stats.active_subscriptions,
    'subscriptionNet30',
    (
      cash_stats.paid_subscription_starts_30
      - subscription_stats.cancellations_30
    ),
    'pastDueSubscriptions',
    subscription_stats.past_due_subscriptions,
    'mrrCents',
    subscription_stats.mrr_cents,
    'revenue30Cents',
    cash_stats.revenue_30_cents,
    'refunds30',
    refund_stats.refunds_30,
    'jobs30',
    job_stats.jobs_30,
    'pages30',
    job_stats.pages_30,
    'completedJobs30',
    quality_stats.completed_jobs_30,
    'failedJobs30',
    quality_stats.failed_jobs_30,
    'onTimeEligible30',
    quality_stats.on_time_eligible_30,
    'deliveredJobs30',
    correction_stats.delivered_jobs_30,
    'failureRate30',
    case
      when (
        quality_stats.completed_jobs_30
        + quality_stats.failed_jobs_30
      ) = 0 then 0
      else round(
        quality_stats.failed_jobs_30::numeric
        * 100
        / (
          quality_stats.completed_jobs_30
          + quality_stats.failed_jobs_30
        ),
        2
      )
    end,
    'onTimeRate30',
    case
      when quality_stats.on_time_eligible_30 = 0 then 0
      else round(
        quality_stats.on_time_jobs_30::numeric
        * 100
        / quality_stats.on_time_eligible_30,
        2
      )
    end,
    'correctionRate30',
    case
      when correction_stats.delivered_jobs_30 = 0 then 0
      else round(
        correction_stats.corrected_jobs_30::numeric
        * 100
        / correction_stats.delivered_jobs_30,
        2
      )
    end,
    'availableCredits',
    credit_stats.available_credits,
    'consumedCredits',
    credit_stats.consumed_credits,
    'companiesWithConfirmedJobs',
    repeat_stats.companies_with_confirmed_jobs,
    'repeatCompanies',
    repeat_stats.repeat_companies,
    'repeatCompanyRate',
    case
      when repeat_stats.companies_with_confirmed_jobs = 0 then 0
      else round(
        repeat_stats.repeat_companies::numeric
        * 100
        / repeat_stats.companies_with_confirmed_jobs,
        2
      )
    end,
    'knownLocationUsers',
    profile_stats.known_location_users,
    'countries',
    profile_stats.countries,
    'missingCountry',
    profile_stats.missing_country,
    'unpricedPlans',
    catalog_stats.unpriced_plans,
    'staleProcessing',
    job_stats.stale_processing,
    'failedStripeEvents',
    stripe_processing_stats.failed_stripe_events,
    'annotationCountedUnits30',
    annotation_stats.counted_units_30,
    'annotationSkipped30',
    annotation_stats.skipped_annotations_30,
    'annotationCoverage30',
    case
      when annotation_stats.counted_units_30 = 0 then 0
      else round(
        greatest(
          0,
          least(
            100,
            (
              annotation_stats.counted_units_30
              - annotation_stats.skipped_annotations_30
            )::numeric
            * 100
            / annotation_stats.counted_units_30
          )
        ),
        2
      )
    end
  ),
  'geography',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'label',
          geography.label,
          'users',
          geography.users
        )
        order by geography.users desc, geography.label
      )
      from geography_rows as geography
    ),
    '[]'::jsonb
  ),
  'statusCounts',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'status',
          status_row.status,
          'count',
          status_row.count
        )
        order by status_row.sort_order
      )
      from status_rows as status_row
    ),
    '[]'::jsonb
  ),
  'funnel',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'name',
          funnel_row.name,
          'count',
          funnel_row.count
        )
        order by funnel_row.sort_order
      )
      from funnel_rows as funnel_row
    ),
    '[]'::jsonb
  ),
  'weeklyUsage',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'weekStart',
          week.week_start,
          'jobs',
          week.jobs,
          'pages',
          week.pages
        )
        order by week.week_start
      )
      from week_rows as week
    ),
    '[]'::jsonb
  )
)
from bounds
cross join profile_stats
cross join subscription_stats
cross join cash_stats
cross join refund_stats
cross join job_stats
cross join quality_stats
cross join correction_stats
cross join annotation_stats
cross join credit_stats
cross join repeat_stats
cross join catalog_stats
cross join stripe_processing_stats;
$$;

revoke execute on function public.get_admin_analytics_snapshot(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_admin_analytics_snapshot(timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Initial commercial catalog and operator settings
-- ---------------------------------------------------------------------------

insert into public.billing_plans (
  slug,
  name,
  description,
  plan_type,
  currency,
  price_cents,
  credits,
  billing_interval,
  stripe_product_id,
  stripe_price_id,
  active,
  sort_order
)
values
  (
    'credits-550',
    '550 Credits',
    'One-time pack of 550 Cuadrabot takeoff credits.',
    'credit_pack',
    'usd',
    50000,
    550,
    'one_time',
    null,
    null,
    true,
    10
  ),
  (
    'credits-1800',
    '1,800 Credits',
    'One-time pack of 1,800 Cuadrabot takeoff credits.',
    'credit_pack',
    'usd',
    150000,
    1800,
    'one_time',
    null,
    null,
    true,
    20
  ),
  (
    'credits-5000',
    '5,000 Credits',
    'One-time pack of 5,000 Cuadrabot takeoff credits.',
    'credit_pack',
    'usd',
    400000,
    5000,
    'one_time',
    null,
    null,
    true,
    30
  ),
  (
    'solo-monthly',
    'Solo',
    'Monthly Solo subscription with 300 takeoff credits.',
    'subscription',
    'usd',
    24900,
    300,
    'month',
    null,
    null,
    true,
    40
  ),
  (
    'team-monthly',
    'Team',
    'Monthly Team subscription with 780 takeoff credits.',
    'subscription',
    'usd',
    59900,
    780,
    'month',
    null,
    null,
    true,
    50
  ),
  (
    'office-monthly',
    'Office',
    'Monthly Office subscription with 1,650 takeoff credits.',
    'subscription',
    'usd',
    119900,
    1650,
    'month',
    null,
    null,
    true,
    60
  )
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  plan_type = excluded.plan_type,
  currency = excluded.currency,
  price_cents = excluded.price_cents,
  credits = excluded.credits,
  billing_interval = excluded.billing_interval,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.app_settings (
  key,
  value,
  description,
  public_readable
)
values
  (
    'features.free_sample',
    '{"enabled": true}'::jsonb,
    'Allow one free takeoff sample per eligible customer.',
    true
  ),
  (
    'features.subscriptions',
    '{"enabled": true}'::jsonb,
    'Expose recurring subscription plans and subscription checkout.',
    true
  ),
  (
    'features.rush',
    '{"enabled": false}'::jsonb,
    'Allow customers to request rush takeoff processing.',
    true
  ),
  (
    'features.maintenance',
    '{"enabled": false, "message": ""}'::jsonb,
    'Place customer-facing takeoff creation into maintenance mode.',
    true
  ),
  (
    'retention.project_files_days',
    '30'::jsonb,
    'Days to keep tracked customer uploads and generated takeoff files after a job is completed, failed, or canceled.',
    true
  )
on conflict (key) do nothing;

-- Preserve all historical packages and orders, but stop offering render SKUs.
update public.packages
set
  active = false,
  updated_at = now()
where slug in ('basic-render', 'pro-render', 'premium-render-pack')
  and active = true;

comment on table public.billing_plans is
  'Server-controlled Stripe catalog for one-time credit packs and recurring subscriptions.';
comment on table public.billing_orders is
  'Immutable commercial snapshots for Stripe checkout purchases; amount is stored in currency minor units and Stripe Price is snapshotted.';
comment on table public.stripe_credit_fulfillments is
  'Service-only fulfillment and refund tombstones that serialize Stripe credit grants against out-of-order webhooks.';
comment on table public.credit_accounts is
  'Current integer credit balance. Mutations must be performed by service-role credit RPCs.';
comment on table public.credit_ledger is
  'Immutable append-only audit ledger for grants, reservations, settlements, releases, and adjustments.';
comment on table public.takeoff_jobs is
  'Authenticated customer takeoff jobs. Rendering-era orders remain in public.orders for legacy audit.';
comment on column public.takeoff_jobs.project_files_purged_at is
  'Set only after tracked Supabase project-file objects and takeoff_files metadata are confirmed absent; job history remains intact.';
comment on column public.takeoff_jobs.project_files_retention_at is
  'Stable terminal-state timestamp used for project-file retention eligibility; purge lease housekeeping does not reset it.';
comment on column public.takeoff_jobs.project_files_purge_token is
  'Short-lived concurrency lease that prevents reactivation or new tracked files while external Storage deletion is running.';
comment on table public.takeoff_files is
  'Metadata for private customer inputs and generated takeoff results.';
comment on table public.stripe_events is
  'Idempotent Stripe webhook inbox keyed by Stripe event ID.';
comment on table public.admin_audit_log is
  'Append-only audit record for privileged operator actions.';
comment on table public.admin_alerts is
  'Operator-facing billing, worker, data, security, and system alerts.';
comment on table public.service_health is
  'Latest operational health snapshots for admin monitoring and alerts.';
comment on table public.api_rate_limits is
  'Server-managed fixed-window request counters. Bucket keys contain only scoped user IDs or keyed IP digests.';
comment on function public.grant_credits(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) is
  'Service-role-only idempotent positive credit grant.';
comment on function public.reverse_credit_grant(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  jsonb
) is
  'Service-role-only exact reversal of an unspent Stripe credit grant with an atomic audit entry.';
comment on function public.fulfill_stripe_credit_grant(
  uuid,
  integer,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  jsonb
) is
  'Service-role-only Stripe grant fulfillment serialized with refund tombstones and optional billing-order completion.';
comment on function public.record_stripe_credit_refund(
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  jsonb
) is
  'Service-role-only full-refund tombstone and atomic unspent grant reversal; suppresses later out-of-order fulfillment.';
comment on function public.admin_sync_billing_catalog(
  jsonb,
  uuid,
  text
) is
  'Service-role-only full fixed-catalog sync with active-admin authorization and an atomic audit entry.';
comment on function public.admin_adjust_credits(
  uuid,
  integer,
  text,
  uuid,
  text,
  text
) is
  'Service-role-only signed operator adjustment with balance protection and an atomic audit entry.';
comment on function public.admin_set_profile_status(
  uuid,
  text,
  uuid,
  text,
  text,
  jsonb
) is
  'Service-role-only active/suspended profile transition with an atomic admin audit entry.';
comment on function public.request_takeoff_correction(uuid, uuid, text) is
  'Service-role-only included-correction request with locked window, retention, source-file, event, alert, and analytics checks.';
comment on function public.admin_resolve_takeoff(uuid, text, text, uuid, text) is
  'Service-role-only correction/exception decision with atomic credit, state, event, analytics, and audit changes.';
comment on function public.admin_schedule_subscription_cancel(
  uuid,
  uuid,
  text,
  text
) is
  'Service-role-only local subscription cancellation flag with an atomic audit entry, called after Stripe accepts the schedule.';
comment on function public.reserve_takeoff_credits(uuid, integer, text, jsonb) is
  'Service-role-only atomic takeoff reservation with a locked balance check.';
comment on function public.settle_takeoff_credits(uuid, text, jsonb) is
  'Service-role-only settlement marker; reserved credits remain debited and become lifetime consumption.';
comment on function public.release_takeoff_credits(uuid, text, jsonb) is
  'Service-role-only release that restores a failed or canceled job reservation.';
comment on function public.complete_takeoff_job(uuid, text, uuid, text, jsonb) is
  'Service-role-only atomic self-serve delivery and credit settlement.';
comment on function public.fail_takeoff_job(
  uuid,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  text,
  timestamptz
) is
  'Service-role-only atomic retry or terminal failure transition with safe credit release.';
comment on function public.queue_free_sample(uuid, text) is
  'Service-role-only atomic free-sample claim and queue transition.';
comment on function public.claim_takeoff_job(uuid, text) is
  'Service-role-only atomic queue claim for a takeoff processor.';
comment on function public.consume_api_rate_limit(text, integer, integer) is
  'Service-role-only atomic fixed-window request limiter.';
comment on function public.guard_takeoff_project_file_retention() is
  'Protects terminal project-file purge leases and clears retention state when a job is reactivated.';
comment on function public.guard_takeoff_file_insert_during_retention() is
  'Serializes tracked file inserts with project-file retention and resets eligibility for later terminal-job files.';
comment on function public.expire_abandoned_takeoff_job(uuid, timestamptz) is
  'Service-role-only atomic cancellation for unfunded upload sessions past their retention cutoff.';
comment on function public.get_admin_analytics_snapshot(timestamptz) is
  'Service-role-only uncapped admin aggregate. Paid revenue is deduplicated from processed Stripe Checkout and subscription invoice events.';

commit;
