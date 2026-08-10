begin;

-- This migration also upgrades the earlier consent-aware analytics schema that
-- was briefly installed in production. The table was empty when this migration
-- was prepared, but the conversions below preserve compatible rows if needed.
create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_id uuid not null,
  session_id uuid not null,
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  page_path text,
  landing_path text,
  referrer_host text,
  source text,
  medium text,
  campaign text,
  term text,
  content text,
  first_source text,
  first_medium text,
  first_campaign text,
  click_id_type text,
  country_code text,
  region text,
  city text,
  device_type text,
  browser_name text,
  os_name text,
  language text,
  timezone text,
  screen_bucket text,
  consent_version smallint not null default 2,
  occurred_at timestamptz not null default now(),
  retention_until timestamptz,
  legal_hold boolean not null default false,
  created_at timestamptz not null default now()
);

lock table public.marketing_events in share row exclusive mode;

-- Remove both generations of check constraints before normalizing columns and
-- values. They are recreated below with the canonical API contract.
do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_record.conname as constraint_name
    from pg_constraint as constraint_record
    join pg_class as relation
      on relation.oid = constraint_record.conrelid
    join pg_namespace as relation_schema
      on relation_schema.oid = relation.relnamespace
    where relation_schema.nspname = 'public'
      and relation.relname = 'marketing_events'
      and constraint_record.contype = 'c'
  loop
    execute format(
      'alter table public.marketing_events drop constraint %I',
      constraint_row.constraint_name
    );
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'browser_family'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'browser_name'
  ) then
    alter table public.marketing_events
      rename column browser_family to browser_name;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'os_family'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'os_name'
  ) then
    alter table public.marketing_events
      rename column os_family to os_name;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'click_id_kind'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'click_id_type'
  ) then
    alter table public.marketing_events
      rename column click_id_kind to click_id_type;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'consented_at'
  ) then
    alter table public.marketing_events
      alter column consented_at drop not null;
  end if;
end;
$$;

alter table public.marketing_events
  add column if not exists page_path text,
  add column if not exists first_source text,
  add column if not exists first_medium text,
  add column if not exists first_campaign text,
  add column if not exists click_id_type text,
  add column if not exists city text,
  add column if not exists browser_name text,
  add column if not exists os_name text,
  add column if not exists language text,
  add column if not exists timezone text,
  add column if not exists screen_bucket text,
  add column if not exists retention_until timestamptz,
  add column if not exists legal_hold boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'anonymous_id'
      and data_type = 'text'
  ) then
    alter table public.marketing_events
      alter column anonymous_id type uuid using anonymous_id::uuid;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'session_id'
      and data_type = 'text'
  ) then
    alter table public.marketing_events
      alter column session_id type uuid using session_id::uuid;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'marketing_events'
      and column_name = 'consent_version'
      and data_type = 'text'
  ) then
    alter table public.marketing_events
      alter column consent_version type smallint using (
        case
          when consent_version ~ '^[0-9]+$' then consent_version::smallint
          else 2
        end
      );
  end if;
end;
$$;

update public.marketing_events
set event_name = case event_name
  when 'signup_started' then 'sign_up_started'
  when 'account_created' then 'sign_up_completed'
  when 'blueprint_upload_started' then 'takeoff_started'
  when 'purchase' then 'purchase_completed'
  else event_name
end;

update public.marketing_events
set device_type = 'unknown'
where device_type = 'other';

update public.marketing_events
set consent_version = 2
where consent_version is distinct from 2;

alter table public.marketing_events
  alter column landing_path drop not null,
  alter column device_type drop not null,
  alter column consent_version set default 2,
  alter column consent_version set not null;

alter table public.marketing_events
  add constraint marketing_events_event_name_check check (
    event_name in (
      'page_view',
      'sign_up_started',
      'sign_up_completed',
      'checkout_started',
      'purchase_completed',
      'takeoff_started'
    )
  ),
  add constraint marketing_events_page_path_check check (
    page_path is null
    or (char_length(page_path) between 1 and 300 and page_path like '/%')
  ),
  add constraint marketing_events_landing_path_check check (
    landing_path is null
    or (char_length(landing_path) between 1 and 300 and landing_path like '/%')
  ),
  add constraint marketing_events_referrer_host_check check (
    referrer_host is null or char_length(referrer_host) <= 253
  ),
  add constraint marketing_events_attribution_length_check check (
    char_length(coalesce(source, '')) <= 120
    and char_length(coalesce(medium, '')) <= 120
    and char_length(coalesce(campaign, '')) <= 200
    and char_length(coalesce(term, '')) <= 200
    and char_length(coalesce(content, '')) <= 200
    and char_length(coalesce(first_source, '')) <= 120
    and char_length(coalesce(first_medium, '')) <= 120
    and char_length(coalesce(first_campaign, '')) <= 200
  ),
  add constraint marketing_events_click_id_type_check check (
    click_id_type is null or click_id_type in ('gclid', 'gbraid', 'wbraid')
  ),
  add constraint marketing_events_country_code_check check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  ),
  add constraint marketing_events_device_type_check check (
    device_type is null
    or device_type in ('desktop', 'mobile', 'tablet', 'bot', 'unknown')
  ),
  add constraint marketing_events_dimensions_length_check check (
    char_length(coalesce(region, '')) <= 120
    and char_length(coalesce(city, '')) <= 120
    and char_length(coalesce(browser_name, '')) <= 40
    and char_length(coalesce(os_name, '')) <= 40
    and char_length(coalesce(language, '')) <= 35
    and char_length(coalesce(timezone, '')) <= 80
    and char_length(coalesce(screen_bucket, '')) <= 30
  ),
  add constraint marketing_events_consent_version_check check (
    consent_version = 2
  ),
  add constraint marketing_events_retention_check check (
    retention_until is null or retention_until > occurred_at
  );

create index if not exists marketing_events_occurred_at_idx
  on public.marketing_events (occurred_at desc);

create index if not exists marketing_events_retention_idx
  on public.marketing_events (retention_until)
  where retention_until is not null and not legal_hold;

create index if not exists marketing_events_campaign_idx
  on public.marketing_events (source, medium, campaign, occurred_at desc);

create index if not exists marketing_events_user_occurred_at_idx
  on public.marketing_events (user_id, occurred_at desc)
  where user_id is not null;

create index if not exists marketing_events_device_idx
  on public.marketing_events (device_type, browser_name, occurred_at desc);

create index if not exists marketing_events_geo_idx
  on public.marketing_events (country_code, region, occurred_at desc)
  where country_code is not null;

alter table public.marketing_events enable row level security;

revoke all on table public.marketing_events from public, anon, authenticated;
grant select, insert, update, delete on table public.marketing_events
  to service_role;

insert into public.app_settings (
  key,
  value,
  description,
  public_readable
)
values (
  'governance.marketing_event_retention',
  '{"mode":"board_pending","days":null,"approved_at":null,"approved_by":null}'::jsonb,
  'Board-controlled retention policy for consented marketing events. No age-based deletion occurs while mode is board_pending.',
  false
)
on conflict (key) do nothing;

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
retention_policy as (
  select coalesce(
    (
      select setting.value
      from public.app_settings as setting
      where setting.key = 'governance.marketing_event_retention'
    ),
    '{"mode":"board_pending","days":null}'::jsonb
  ) as value
),
current_events as (
  select event.*
  from public.marketing_events as event
  cross join bounds
  where event.occurred_at >= bounds.current_30
    and event.occurred_at < bounds.as_of
),
metrics as (
  select
    count(*) filter (where event_name = 'page_view')::bigint as page_views,
    count(distinct anonymous_id)::bigint as visitors,
    count(distinct session_id)::bigint as sessions,
    count(*) filter (where user_id is not null)::bigint as identified_events,
    count(*) filter (where country_code is not null)::bigint as located_events
  from current_events
),
campaigns as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'source', ranked.source,
        'medium', ranked.medium,
        'campaign', ranked.campaign,
        'visitors', ranked.visitors,
        'sessions', ranked.sessions,
        'page_views', ranked.page_views
      ) order by ranked.visitors desc, ranked.page_views desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      coalesce(nullif(source, ''), '(direct)') as source,
      coalesce(nullif(medium, ''), '(none)') as medium,
      coalesce(nullif(campaign, ''), '(not set)') as campaign,
      count(distinct anonymous_id)::bigint as visitors,
      count(distinct session_id)::bigint as sessions,
      count(*) filter (where event_name = 'page_view')::bigint as page_views
    from current_events
    group by 1, 2, 3
    order by visitors desc, page_views desc
    limit 25
  ) as ranked
),
devices as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'device', ranked.device,
        'browser', ranked.browser,
        'os', ranked.os,
        'visitors', ranked.visitors
      ) order by ranked.visitors desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      coalesce(device_type, 'unknown') as device,
      coalesce(browser_name, 'Unknown') as browser,
      coalesce(os_name, 'Unknown') as os,
      count(distinct anonymous_id)::bigint as visitors
    from current_events
    group by 1, 2, 3
    order by visitors desc
    limit 25
  ) as ranked
),
locations as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'country', ranked.country,
        'region', ranked.region,
        'visitors', ranked.visitors
      ) order by ranked.visitors desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      country_code as country,
      coalesce(region, '(not set)') as region,
      count(distinct anonymous_id)::bigint as visitors
    from current_events
    where country_code is not null
    group by 1, 2
    order by visitors desc
    limit 25
  ) as ranked
),
languages as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'language', ranked.language,
        'timezone', ranked.timezone,
        'visitors', ranked.visitors
      ) order by ranked.visitors desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      coalesce(language, '(not set)') as language,
      coalesce(timezone, '(not set)') as timezone,
      count(distinct anonymous_id)::bigint as visitors
    from current_events
    group by 1, 2
    order by visitors desc
    limit 25
  ) as ranked
),
pages as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'path', ranked.path,
        'page_views', ranked.page_views,
        'visitors', ranked.visitors
      ) order by ranked.page_views desc
    ),
    '[]'::jsonb
  ) as value
  from (
    select
      coalesce(page_path, '/') as path,
      count(*) filter (where event_name = 'page_view')::bigint as page_views,
      count(distinct anonymous_id)::bigint as visitors
    from current_events
    group by 1
    order by page_views desc
    limit 25
  ) as ranked
)
select jsonb_build_object(
  'as_of', bounds.as_of,
  'window_days', 30,
  'retention_policy', coalesce(
    retention_policy.value ->> 'mode',
    'board_pending'
  ),
  'retention_days', retention_policy.value -> 'days',
  'metrics', jsonb_build_object(
    'page_views', metrics.page_views,
    'visitors', metrics.visitors,
    'sessions', metrics.sessions,
    'identified_events', metrics.identified_events,
    'located_events', metrics.located_events
  ),
  'campaigns', campaigns.value,
  'devices', devices.value,
  'locations', locations.value,
  'languages', languages.value,
  'pages', pages.value
)
from bounds
cross join metrics
cross join retention_policy
cross join campaigns
cross join devices
cross join locations
cross join languages
cross join pages;
$$;

revoke execute on function public.get_admin_marketing_snapshot(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_admin_marketing_snapshot(timestamptz)
  to service_role;

comment on table public.marketing_events is
  'Regionally consent-scoped first-party marketing events. No raw IP addresses, user-agent strings, payment details, project files, or arbitrary browser cookies are stored. Age-based retention requires an approved governance policy; individual rights and legal holds remain separate.';

comment on function public.get_admin_marketing_snapshot(timestamptz) is
  'Returns uncapped 30-day aggregate marketing intelligence to server-side administrators.';

commit;
