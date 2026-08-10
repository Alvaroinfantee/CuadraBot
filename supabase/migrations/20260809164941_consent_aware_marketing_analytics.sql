-- Consent-aware first-party marketing analytics.
--
-- Keep this data separate from public.analytics_events. The existing table
-- contains necessary product and operational events, while every row below
-- requires an explicit marketing-consent signal from the browser.

alter table public.profiles
  add column if not exists age_band text,
  add column if not exists demographic_consent_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_age_band_check;

alter table public.profiles
  add constraint profiles_age_band_check
  check (
    age_band is null
    or age_band in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')
  );

alter table public.profiles
  drop constraint if exists profiles_demographic_consent_check;

alter table public.profiles
  add constraint profiles_demographic_consent_check
  check (
    (age_band is null and demographic_consent_at is null)
    or (age_band is not null and demographic_consent_at is not null)
  );

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  anonymous_id text not null,
  session_id text not null,
  event_name text not null,
  consent_version text not null,
  consented_at timestamptz not null,
  country_code text,
  region text,
  device_type text not null,
  browser_family text,
  os_family text,
  age_band text,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  click_id_kind text,
  click_id text,
  landing_path text not null,
  referrer_host text,
  tags jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint marketing_events_anonymous_id_check
    check (anonymous_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint marketing_events_session_id_check
    check (session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  constraint marketing_events_name_check
    check (
      event_name in (
        'page_view',
        'signup_started',
        'account_created',
        'blueprint_upload_started',
        'checkout_started',
        'purchase'
      )
    ),
  constraint marketing_events_consent_version_check
    check (char_length(consent_version) between 1 and 32),
  constraint marketing_events_country_code_check
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint marketing_events_device_type_check
    check (device_type in ('mobile', 'tablet', 'desktop', 'other')),
  constraint marketing_events_age_band_check
    check (
      age_band is null
      or age_band in ('18-24', '25-34', '35-44', '45-54', '55-64', '65+')
    ),
  constraint marketing_events_click_id_check
    check (
      (click_id_kind is null and click_id is null)
      or (
        click_id_kind in ('gclid', 'gbraid', 'wbraid', 'msclkid', 'fbclid')
        and click_id is not null
        and char_length(click_id) between 1 and 500
      )
    ),
  constraint marketing_events_landing_path_check
    check (
      landing_path like '/%'
      and char_length(landing_path) between 1 and 500
    ),
  constraint marketing_events_tags_object_check
    check (jsonb_typeof(tags) = 'object'),
  constraint marketing_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists marketing_events_occurred_at_idx
  on public.marketing_events (occurred_at desc);

create index if not exists marketing_events_event_occurred_at_idx
  on public.marketing_events (event_name, occurred_at desc);

create index if not exists marketing_events_visitor_occurred_at_idx
  on public.marketing_events (anonymous_id, occurred_at desc);

create index if not exists marketing_events_user_occurred_at_idx
  on public.marketing_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists marketing_events_campaign_occurred_at_idx
  on public.marketing_events (source, medium, campaign, occurred_at desc);

create index if not exists marketing_events_geo_occurred_at_idx
  on public.marketing_events (country_code, occurred_at desc)
  where country_code is not null;

alter table public.marketing_events enable row level security;

revoke all on table public.marketing_events
  from public, anon, authenticated;
grant select, insert, delete on table public.marketing_events
  to service_role;

create or replace function public.get_admin_marketing_snapshot(
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
    p_as_of - interval '30 days' as current_30
),
events_30 as (
  select marketing_event.*
  from public.marketing_events as marketing_event
  cross join bounds
  where marketing_event.occurred_at >= bounds.current_30
    and marketing_event.occurred_at < bounds.as_of
),
device_rows as (
  select
    event.device_type as label,
    count(*)::bigint as events,
    count(distinct event.anonymous_id)::bigint as visitors
  from events_30 as event
  group by event.device_type
),
geography_rows as (
  select
    coalesce(event.country_code, 'Unknown') as label,
    count(*)::bigint as events,
    count(distinct event.anonymous_id)::bigint as visitors
  from events_30 as event
  group by coalesce(event.country_code, 'Unknown')
),
age_rows as (
  select
    event.age_band as label,
    count(distinct event.anonymous_id)::bigint as visitors
  from events_30 as event
  where event.age_band is not null
  group by event.age_band
),
campaign_rows as (
  select
    coalesce(nullif(btrim(event.source), ''), '(direct)') as source,
    coalesce(nullif(btrim(event.medium), ''), '(none)') as medium,
    coalesce(nullif(btrim(event.campaign), ''), '(not set)') as campaign,
    count(*)::bigint as events,
    count(distinct event.anonymous_id)::bigint as visitors,
    count(*) filter (where event.event_name = 'account_created')::bigint
      as accounts_created,
    count(*) filter (
      where event.event_name = 'blueprint_upload_started'
    )::bigint as blueprint_uploads_started,
    count(*) filter (where event.event_name = 'checkout_started')::bigint
      as checkouts_started,
    count(*) filter (where event.event_name = 'purchase')::bigint
      as purchases
  from events_30 as event
  group by
    coalesce(nullif(btrim(event.source), ''), '(direct)'),
    coalesce(nullif(btrim(event.medium), ''), '(none)'),
    coalesce(nullif(btrim(event.campaign), ''), '(not set)')
)
select jsonb_build_object(
  'asOf',
  bounds.as_of,
  'metrics',
  jsonb_build_object(
    'events30', (select count(*)::bigint from events_30),
    'visitors30', (
      select count(distinct event.anonymous_id)::bigint
      from events_30 as event
    ),
    'sessions30', (
      select count(distinct event.session_id)::bigint
      from events_30 as event
    ),
    'pageViews30', (
      select count(*) filter (where event.event_name = 'page_view')::bigint
      from events_30 as event
    ),
    'accountsCreated30', (
      select count(*) filter (where event.event_name = 'account_created')::bigint
      from events_30 as event
    ),
    'blueprintUploadsStarted30', (
      select count(*) filter (
        where event.event_name = 'blueprint_upload_started'
      )::bigint
      from events_30 as event
    ),
    'checkoutsStarted30', (
      select count(*) filter (where event.event_name = 'checkout_started')::bigint
      from events_30 as event
    ),
    'purchases30', (
      select count(*) filter (where event.event_name = 'purchase')::bigint
      from events_30 as event
    )
  ),
  'devices',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'label', device.label,
          'events', device.events,
          'visitors', device.visitors
        )
        order by device.visitors desc, device.label
      )
      from device_rows as device
    ),
    '[]'::jsonb
  ),
  'geography',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'label', geography.label,
          'events', geography.events,
          'visitors', geography.visitors
        )
        order by geography.visitors desc, geography.label
      )
      from geography_rows as geography
    ),
    '[]'::jsonb
  ),
  'ageBands',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'label', age.label,
          'visitors', age.visitors
        )
        order by age.label
      )
      from age_rows as age
    ),
    '[]'::jsonb
  ),
  'campaigns',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'source', campaign.source,
          'medium', campaign.medium,
          'campaign', campaign.campaign,
          'events', campaign.events,
          'visitors', campaign.visitors,
          'accountsCreated', campaign.accounts_created,
          'blueprintUploadsStarted', campaign.blueprint_uploads_started,
          'checkoutsStarted', campaign.checkouts_started,
          'purchases', campaign.purchases
        )
        order by campaign.visitors desc, campaign.source, campaign.campaign
      )
      from campaign_rows as campaign
    ),
    '[]'::jsonb
  )
)
from bounds;
$$;

revoke execute on function public.get_admin_marketing_snapshot(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_admin_marketing_snapshot(timestamptz)
  to service_role;

comment on table public.marketing_events is
  'Consent-only first-party acquisition and conversion events. Raw IP addresses and full user-agent strings are intentionally excluded.';

comment on column public.profiles.age_band is
  'Optional self-declared age range; never inferred. A value requires demographic_consent_at.';

comment on function public.get_admin_marketing_snapshot(timestamptz) is
  'Service-role-only 30-day aggregate of consented acquisition, device, geography, demographic, and purchase signals.';
