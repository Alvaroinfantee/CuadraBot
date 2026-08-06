-- Per-attempt processor usage and estimated API cost are operational data.
-- They intentionally live outside takeoff_jobs.result_summary because customers
-- can select their own job rows.
-- Deploy this new table together with the matching processor, worker, and app
-- release: schema_version 1 requires both all-input-uncached estimate fields.

-- The annotated copy can be slightly larger than the 100 MiB source upload.
-- Application descriptor validation still holds JSON to 50 MiB and XLSX to
-- 100 MiB; this bucket-level ceiling matches the PDF/worker absolute cap.
update storage.buckets
set file_size_limit = 262144000
where id = 'takeoff-results';

-- Jobs created before the pinned analysis profile was introduced have a null
-- processor_version. Backfill only unclaimed/non-processing jobs whose stored
-- trades map losslessly to the new fixture/cable processor. Obsolete flooring,
-- drywall, and openings work remains null and therefore continues to fail
-- closed instead of being silently reinterpreted.
update public.takeoff_jobs
set processor_version = 'analyze-building-drawings@2026-08-06'
where processor_version is null
  and status in (
    'draft',
    'awaiting_upload',
    'ready',
    'queued',
    'needs_review'
  )
  and cardinality(trades) > 0
  and trades <@ array[
    'electrical_fixtures',
    'other_legend_devices',
    'fixture_device_counts',
    'cable_conduit_runs'
  ]::text[];

create table if not exists public.takeoff_processor_usage (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.takeoff_jobs(id) on delete cascade,
  claim_token uuid not null,
  worker_id text not null check (btrim(worker_id) <> ''),
  processor_job_id text,
  schema_version smallint not null check (schema_version = 1),
  provider text not null check (provider = 'openai'),
  model text not null check (btrim(model) <> ''),
  pricing_as_of date not null,
  currency text not null check (currency = 'USD'),
  usage_turns integer not null check (usage_turns >= 1),
  input_tokens bigint not null check (input_tokens >= 0),
  uncached_input_tokens bigint not null check (uncached_input_tokens >= 0),
  cached_input_tokens bigint not null check (cached_input_tokens >= 0),
  cache_write_tokens bigint not null check (cache_write_tokens >= 0),
  output_tokens bigint not null check (output_tokens >= 0),
  reasoning_output_tokens bigint not null check (
    reasoning_output_tokens >= 0
    and reasoning_output_tokens <= output_tokens
  ),
  estimated_cost_usd numeric(18, 8) not null check (
    estimated_cost_usd >= 0
  ),
  estimated_cost_usd_upper_bound numeric(18, 8) check (
    estimated_cost_usd_upper_bound is null
    or estimated_cost_usd_upper_bound >= estimated_cost_usd
  ),
  estimated_cost_usd_all_input_uncached numeric(18, 8) not null check (
    estimated_cost_usd_all_input_uncached >= 0
  ),
  estimated_cost_usd_all_input_uncached_upper_bound numeric(18, 8) check (
    estimated_cost_usd_all_input_uncached_upper_bound is null
    or estimated_cost_usd_all_input_uncached_upper_bound >=
      estimated_cost_usd_all_input_uncached
  ),
  long_context_pricing_may_apply boolean not null default false,
  rate_snapshot_usd_per_million jsonb not null check (
    jsonb_typeof(rate_snapshot_usd_per_million) = 'object'
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint takeoff_processor_usage_attempt_unique
    unique (job_id, claim_token),
  constraint takeoff_processor_usage_input_reconciles check (
    input_tokens =
      uncached_input_tokens + cached_input_tokens + cache_write_tokens
  ),
  constraint takeoff_processor_usage_long_context_range check (
    long_context_pricing_may_apply =
      (estimated_cost_usd_upper_bound is not null)
    and long_context_pricing_may_apply =
      (estimated_cost_usd_all_input_uncached_upper_bound is not null)
  )
);

create index if not exists takeoff_processor_usage_job_created_idx
  on public.takeoff_processor_usage (job_id, created_at);

alter table public.takeoff_processor_usage enable row level security;

revoke all on table public.takeoff_processor_usage
  from public, anon, authenticated;
grant select, insert, update on table public.takeoff_processor_usage
  to service_role;

comment on table public.takeoff_processor_usage is
  'Admin-only per-attempt OpenAI usage, estimated API cost, and hypothetical all-input-uncached cost.';
