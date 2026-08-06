begin;

-- Keep the private source bucket aligned with the launch-safe 25 MB product
-- limit. Verification streams the object to a private temporary file and
-- delegates parsing to a resource-limited, non-root qpdf subprocess.
update storage.buckets
set file_size_limit = 26214400
where id = 'takeoff-uploads';

-- A bootstrap grant is an intentionally short-lived capability. The raw
-- 256-bit key is never stored: only its 32-byte SHA-256 digest is provisioned.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.admin_bootstrap_grants (
  id uuid primary key default gen_random_uuid(),
  email text not null
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 320
      and position('@' in email) > 1
    ),
  key_digest bytea not null unique
    check (octet_length(key_digest) = 32),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint admin_bootstrap_grants_expiry_check check (
    expires_at > created_at
    and expires_at <= created_at + interval '24 hours'
  ),
  constraint admin_bootstrap_grants_use_state_check check (
    (used_at is null and used_by is null)
    or (used_at is not null and used_by is not null)
  ),
  constraint admin_bootstrap_grants_terminal_state_check check (
    not (used_at is not null and revoked_at is not null)
  ),
  constraint admin_bootstrap_grants_revocation_reason_check check (
    (revoked_at is null and revocation_reason is null)
    or (
      revoked_at is not null
      and nullif(btrim(revocation_reason), '') is not null
      and char_length(revocation_reason) <= 500
    )
  )
);

create unique index if not exists admin_bootstrap_grants_one_active_email_idx
  on private.admin_bootstrap_grants (email)
  where used_at is null and revoked_at is null;

create index if not exists admin_bootstrap_grants_expires_at_idx
  on private.admin_bootstrap_grants (expires_at)
  where used_at is null and revoked_at is null;

create table if not exists private.admin_bootstrap_attempts (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references private.admin_bootstrap_grants(id)
    on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  outcome text not null check (
    outcome in (
      'redeemed',
      'invalid',
      'expired',
      'already_used',
      'revoked',
      'ineligible',
      'throttled'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists admin_bootstrap_attempts_user_created_at_idx
  on private.admin_bootstrap_attempts (user_id, created_at desc);

create index if not exists admin_bootstrap_attempts_fingerprint_created_at_idx
  on private.admin_bootstrap_attempts (request_fingerprint, created_at desc);

alter table private.admin_bootstrap_grants enable row level security;
alter table private.admin_bootstrap_attempts enable row level security;

revoke all on table private.admin_bootstrap_grants
  from public, anon, authenticated;
revoke all on table private.admin_bootstrap_attempts
  from public, anon, authenticated;

grant all privileges on table
  private.admin_bootstrap_grants,
  private.admin_bootstrap_attempts
to service_role;

create or replace function public.redeem_admin_bootstrap(
  p_user_id uuid,
  p_key_digest text,
  p_request_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := clock_timestamp();
  canonical_email text;
  email_confirmed_at timestamptz;
  current_profile public.profiles;
  selected_grant private.admin_bootstrap_grants;
  user_failures integer;
  fingerprint_failures integer;
  attempt_outcome text;
begin
  if p_user_id is null
     or p_key_digest !~ '^[a-f0-9]{64}$'
     or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid bootstrap request.';
  end if;

  select
    lower(btrim(auth_user.email)),
    auth_user.email_confirmed_at
  into canonical_email, email_confirmed_at
  from auth.users as auth_user
  where auth_user.id = p_user_id;

  if not found or canonical_email is null then
    raise exception 'Invalid bootstrap request.';
  end if;

  select profile.*
  into current_profile
  from public.profiles as profile
  where profile.id = p_user_id;

  if not found then
    raise exception 'Invalid bootstrap request.';
  end if;

  select
    count(*) filter (
      where attempt.user_id = p_user_id
        and attempt.outcome <> 'redeemed'
    )::integer,
    count(*) filter (
      where attempt.request_fingerprint = p_request_fingerprint
        and attempt.outcome <> 'redeemed'
    )::integer
  into user_failures, fingerprint_failures
  from private.admin_bootstrap_attempts as attempt
  where attempt.created_at >= request_time - interval '15 minutes'
    and (
      attempt.user_id = p_user_id
      or attempt.request_fingerprint = p_request_fingerprint
    );

  if user_failures >= 5 or fingerprint_failures >= 15 then
    insert into private.admin_bootstrap_attempts (
      user_id,
      request_fingerprint,
      outcome,
      created_at
    )
    values (
      p_user_id,
      p_request_fingerprint,
      'throttled',
      request_time
    );

    return jsonb_build_object(
      'redeemed', false,
      'throttled', true,
      'retry_after_seconds', 900
    );
  end if;

  select grant_row.*
  into selected_grant
  from private.admin_bootstrap_grants as grant_row
  where grant_row.email = canonical_email
  order by
    (grant_row.used_at is null and grant_row.revoked_at is null) desc,
    grant_row.created_at desc
  limit 1
  for update;

  if not found then
    attempt_outcome := 'invalid';
  elsif selected_grant.used_at is not null then
    attempt_outcome := 'already_used';
  elsif selected_grant.revoked_at is not null then
    attempt_outcome := 'revoked';
  elsif selected_grant.expires_at <= request_time then
    attempt_outcome := 'expired';
  elsif email_confirmed_at is null
     or current_profile.status <> 'active' then
    attempt_outcome := 'ineligible';
  elsif selected_grant.key_digest <> decode(p_key_digest, 'hex') then
    attempt_outcome := 'invalid';
  else
    update public.profiles
    set
      role = 'admin',
      updated_at = request_time
    where id = p_user_id
      and status = 'active';

    if not found then
      attempt_outcome := 'ineligible';
    else
      update private.admin_bootstrap_grants
      set
        used_at = request_time,
        used_by = p_user_id
      where id = selected_grant.id
        and used_at is null
        and revoked_at is null;

      if not found then
        raise exception 'Bootstrap grant state changed unexpectedly.';
      end if;

      insert into private.admin_bootstrap_attempts (
        grant_id,
        user_id,
        request_fingerprint,
        outcome,
        created_at
      )
      values (
        selected_grant.id,
        p_user_id,
        p_request_fingerprint,
        'redeemed',
        request_time
      );

      insert into public.admin_audit_log (
        actor_user_id,
        actor_email,
        action,
        target_type,
        target_id,
        reason,
        before_state,
        after_state,
        metadata,
        created_at
      )
      values (
        p_user_id,
        canonical_email,
        'admin_bootstrap_redeemed',
        'profile',
        p_user_id::text,
        'One-time, pre-provisioned administrator bootstrap grant redeemed.',
        jsonb_build_object('role', current_profile.role),
        jsonb_build_object('role', 'admin'),
        jsonb_build_object('bootstrap_grant_id', selected_grant.id),
        request_time
      );

      return jsonb_build_object(
        'redeemed', true,
        'throttled', false,
        'retry_after_seconds', 0
      );
    end if;
  end if;

  insert into private.admin_bootstrap_attempts (
    grant_id,
    user_id,
    request_fingerprint,
    outcome,
    created_at
  )
  values (
    selected_grant.id,
    p_user_id,
    p_request_fingerprint,
    attempt_outcome,
    request_time
  );

  return jsonb_build_object(
    'redeemed', false,
    'throttled', false,
    'retry_after_seconds', 0
  );
end;
$$;

revoke execute on function public.redeem_admin_bootstrap(
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.redeem_admin_bootstrap(
  uuid,
  text,
  text
) to service_role;

comment on table private.admin_bootstrap_grants is
  'Private, expiring, single-use admin bootstrap capabilities. Stores only a SHA-256 digest of each 256-bit key.';
comment on table private.admin_bootstrap_attempts is
  'Private audit and throttling records for administrator bootstrap redemption attempts; raw keys and raw IP addresses are never stored.';
comment on function public.redeem_admin_bootstrap(uuid, text, text) is
  'Service-role-only atomic redemption of an expiring grant for the exact confirmed auth email; promotion, consumption, throttling, and audit commit together.';

commit;
