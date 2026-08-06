-- Secure, checksum-backed source-plan archive.
--
-- File bytes remain in the private takeoff-uploads bucket. Postgres stores the
-- durable registry, integrity metadata, ownership, and lifecycle state. This
-- keeps large PDFs out of the database while preserving an auditable index.

alter table public.takeoff_jobs
  add column upload_cleanup_completed_at timestamptz;

create index takeoff_jobs_upload_cleanup_pending_idx
  on public.takeoff_jobs (updated_at)
  where status = 'canceled'
    and stage = 'upload_expired'
    and upload_cleanup_completed_at is null;

create table public.document_archives (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  user_id uuid not null,
  bucket text not null check (bucket = 'takeoff-uploads'),
  storage_path text not null,
  original_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes >= 5),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer not null check (page_count > 0),
  status text not null default 'retained' check (
    status in (
      'retained',
      'deletion_requested',
      'deleting',
      'deleted'
    )
  ),
  integrity_status text not null default 'verified' check (
    integrity_status in ('verified', 'missing')
  ),
  legal_hold_at timestamptz,
  legal_hold_reason text,
  legal_hold_by uuid references public.profiles(id),
  deletion_requested_at timestamptz,
  deletion_request_reason text,
  deletion_requested_by uuid references public.profiles(id),
  deletion_token uuid,
  deletion_started_at timestamptz,
  deletion_approved_by uuid references public.profiles(id),
  archived_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now(),
  last_check_attempt_at timestamptz not null default now(),
  deleted_at timestamptz,
  deletion_reason text,
  constraint document_archives_job_user_fk
    foreign key (job_id, user_id)
    references public.takeoff_jobs(id, user_id),
  constraint document_archives_job_unique unique (job_id),
  constraint document_archives_bucket_path_unique
    unique (bucket, storage_path),
  constraint document_archives_path_namespace_check check (
    storage_path like user_id::text || '/' || job_id::text || '/%'
  ),
  constraint document_archives_deleted_state_check check (
    (
      status = 'deleted'
      and deleted_at is not null
      and nullif(btrim(deletion_reason), '') is not null
    )
    or
    (
      status <> 'deleted'
      and deleted_at is null
    )
  ),
  constraint document_archives_hold_fields_check check (
    (
      legal_hold_at is null
      and legal_hold_reason is null
      and legal_hold_by is null
    )
    or
    (
      legal_hold_at is not null
      and nullif(btrim(legal_hold_reason), '') is not null
      and legal_hold_by is not null
      and status <> 'deleted'
    )
  ),
  constraint document_archives_deletion_request_fields_check check (
    (
      deletion_requested_at is null
      and deletion_request_reason is null
      and deletion_requested_by is null
      and status not in ('deletion_requested', 'deleting', 'deleted')
    )
    or
    (
      deletion_requested_at is not null
      and nullif(btrim(deletion_request_reason), '') is not null
      and deletion_requested_by is not null
      and status in ('deletion_requested', 'deleting', 'deleted')
    )
  ),
  constraint document_archives_deletion_claim_fields_check check (
    (
      status not in ('deleting', 'deleted')
      and deletion_token is null
      and deletion_started_at is null
      and deletion_approved_by is null
    )
    or
    (
      status = 'deleting'
      and deletion_token is not null
      and deletion_started_at is not null
      and deletion_approved_by is not null
    )
    or
    (
      status = 'deleted'
      and deletion_token is null
      and deletion_started_at is not null
      and deletion_approved_by is not null
    )
  )
);

create index document_archives_user_archived_at_idx
  on public.document_archives (user_id, archived_at desc);

create index document_archives_status_verified_at_idx
  on public.document_archives (status, last_verified_at);

create index document_archives_integrity_verified_at_idx
  on public.document_archives (integrity_status, last_check_attempt_at)
  where status <> 'deleted';

create index document_archives_check_attempt_idx
  on public.document_archives (last_check_attempt_at)
  where status <> 'deleted';

alter table public.document_archives enable row level security;

-- Source objects are served only through the ownership-checked application
-- route. Customers still read result objects through their separate policy,
-- while opaque upload paths cannot bypass archive lifecycle checks.
drop policy if exists "takeoff uploads owner read" on storage.objects;

create policy "customers read own archived documents"
on public.document_archives
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.current_user_is_active())
);

revoke all on table public.document_archives
  from public, anon, authenticated;
grant select (
  id,
  job_id,
  user_id,
  original_filename,
  mime_type,
  size_bytes,
  sha256,
  page_count,
  status,
  integrity_status,
  archived_at,
  last_verified_at,
  last_check_attempt_at,
  deleted_at
) on table public.document_archives to authenticated;
revoke all on table public.document_archives from service_role;
grant select on table public.document_archives to service_role;

create or replace function public.guard_document_archive_tombstone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Document archive rows are permanent tombstones and cannot be deleted.';
  end if;

  if old.job_id is distinct from new.job_id
     or old.user_id is distinct from new.user_id
     or old.bucket is distinct from new.bucket
     or old.storage_path is distinct from new.storage_path
     or old.original_filename is distinct from new.original_filename
     or old.mime_type is distinct from new.mime_type
     or old.size_bytes is distinct from new.size_bytes
     or old.sha256 is distinct from new.sha256
     or old.page_count is distinct from new.page_count
     or old.archived_at is distinct from new.archived_at then
    raise exception 'Document archive identity and verification metadata are immutable.';
  end if;

  if old.status = 'deleted' and new is distinct from old then
    raise exception 'A deleted document archive tombstone is immutable.';
  end if;

  if old.status = 'retained'
     and new.status not in ('retained', 'deletion_requested') then
    raise exception 'A retained source must enter deletion_requested before deletion.';
  end if;

  if old.status = 'deletion_requested'
     and new.status not in ('retained', 'deletion_requested', 'deleting') then
    raise exception 'The document archive lifecycle transition is invalid.';
  end if;

  if old.status = 'deleting'
     and new.status not in ('deleting', 'deletion_requested', 'deleted') then
    raise exception 'The document archive lifecycle transition is invalid.';
  end if;

  if new.last_verified_at < old.last_verified_at then
    raise exception 'Document archive verification time cannot move backwards.';
  end if;

  if new.last_check_attempt_at < old.last_check_attempt_at then
    raise exception 'Document archive check-attempt time cannot move backwards.';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_document_archive_tombstone()
  from public, anon, authenticated;

create trigger document_archives_guard_tombstone
before update or delete on public.document_archives
for each row execute function public.guard_document_archive_tombstone();

-- Preserve every recoverable verified source that predates this migration.
-- Historical free samples cannot be backfilled because the previous workflow
-- intentionally replaced their full original with sample.pdf.
insert into public.document_archives (
  job_id,
  user_id,
  bucket,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  sha256,
  page_count,
  status,
  integrity_status,
  archived_at,
  last_verified_at,
  last_check_attempt_at
)
select
  file.job_id,
  file.user_id,
  file.bucket,
  file.storage_path,
  file.original_filename,
  'application/pdf',
  file.size_bytes,
  file.sha256,
  file.page_count,
  'retained',
  'verified',
  file.verified_at,
  file.verified_at,
  now()
from public.takeoff_files as file
join public.takeoff_jobs as job
  on job.id = file.job_id
 and job.user_id = file.user_id
where file.file_role = 'input'
  and file.bucket = 'takeoff-uploads'
  and file.verified_at is not null
  and file.size_bytes >= 5
  and file.sha256 ~ '^[a-f0-9]{64}$'
  and file.page_count > 0
  and job.free_sample is false
on conflict (job_id) do nothing;

with archive_gaps as (
  select
    job.id,
    job.free_sample
  from public.takeoff_jobs as job
  where job.input_page_count > 0
    and job.status not in ('draft', 'awaiting_upload')
    and not exists (
      select 1
      from public.document_archives as archive
      where archive.job_id = job.id
    )
)
insert into public.admin_alerts (
  severity,
  category,
  title,
  message,
  status,
  dedupe_key,
  metadata
)
select
  'critical',
  'data',
  'Historical source plans need archive review',
  'One or more verified jobs could not be backfilled into the source archive. Historical free-sample originals may already have been removed by the previous workflow.',
  'open',
  'document-archive:historical-backfill-gaps',
  jsonb_build_object(
    'job_count',
    count(*),
    'free_sample_jobs',
    count(*) filter (where archive_gaps.free_sample)
  )
from archive_gaps
having count(*) > 0
on conflict do nothing;

create or replace function public.register_verified_document_archive(
  p_job_id uuid,
  p_user_id uuid,
  p_verification_token uuid,
  p_file_id uuid,
  p_size_bytes bigint,
  p_sha256 text,
  p_page_count integer
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.takeoff_jobs;
  source_file public.takeoff_files;
  existing_archive public.document_archives;
  registered_archive public.document_archives;
  required_prefix text;
  archive_bytes bigint;
  archive_count bigint;
  archive_limit_bytes bigint;
  archive_limit_count bigint;
  has_paid_archive_capacity boolean;
begin
  if p_job_id is null
     or p_user_id is null
     or p_verification_token is null
     or p_file_id is null
     or p_size_bytes < 5
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_page_count < 1 then
    raise exception 'The source-plan archive metadata is invalid.';
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
  if left(source_file.storage_path, char_length(required_prefix))
       <> required_prefix then
    raise exception 'The source-plan path is outside the takeoff namespace.';
  end if;

  select archive.*
  into existing_archive
  from public.document_archives as archive
  where archive.job_id = job.id
  for update;

  if existing_archive.id is not null then
    if existing_archive.user_id <> job.user_id
       or existing_archive.bucket <> source_file.bucket
       or existing_archive.storage_path <> source_file.storage_path
       or existing_archive.original_filename <> source_file.original_filename
       or existing_archive.size_bytes <> p_size_bytes
       or existing_archive.sha256 <> p_sha256
       or existing_archive.page_count <> p_page_count
       or existing_archive.status = 'deleted' then
      raise exception 'The existing source-plan archive does not match.';
    end if;

    update public.document_archives as archive
    set
      integrity_status = 'verified',
      last_verified_at = now(),
      last_check_attempt_at = now()
    where archive.id = existing_archive.id
    returning archive.* into registered_archive;

    return registered_archive;
  end if;

  -- Serialize per-account capacity checks so rotating unpaid quote requests
  -- cannot accumulate an unbounded durable archive.
  perform 1
  from public.profiles as profile
  where profile.id = job.user_id
  for update;

  select
    exists (
      select 1
      from public.subscriptions as subscription
      where subscription.user_id = job.user_id
        and subscription.status in ('trialing', 'active', 'past_due')
    )
    or exists (
      select 1
      from public.billing_orders as billing_order
      join public.stripe_credit_fulfillments as fulfillment
        on fulfillment.billing_order_id = billing_order.id
       and fulfillment.user_id = billing_order.user_id
       and fulfillment.status = 'fulfilled'
      where billing_order.user_id = job.user_id
        and billing_order.kind = 'credit_pack'
        and billing_order.status = 'fulfilled'
    )
  into has_paid_archive_capacity;

  archive_limit_bytes := case
    when has_paid_archive_capacity then 21474836480::bigint -- 20 GiB
    else 536870912::bigint -- 512 MiB
  end;
  archive_limit_count := case
    when has_paid_archive_capacity then 500
    else 25
  end;

  select
    coalesce(sum(archive.size_bytes), 0),
    count(*)
  into archive_bytes, archive_count
  from public.document_archives as archive
  where archive.user_id = job.user_id
    and archive.status <> 'deleted';

  if archive_bytes + p_size_bytes > archive_limit_bytes
     or archive_count + 1 > archive_limit_count then
    raise exception
      'Source archive capacity reached. Contact support before verifying another plan.';
  end if;

  insert into public.document_archives (
    job_id,
    user_id,
    bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    page_count,
    status,
    integrity_status,
    archived_at,
    last_verified_at,
    last_check_attempt_at
  )
  values (
    job.id,
    job.user_id,
    source_file.bucket,
    source_file.storage_path,
    source_file.original_filename,
    'application/pdf',
    p_size_bytes,
    p_sha256,
    p_page_count,
    'retained',
    'verified',
    now(),
    now(),
    now()
  )
  returning * into registered_archive;

  insert into public.analytics_events (
    user_id,
    job_id,
    event_name,
    source,
    metadata
  )
  values (
    job.user_id,
    job.id,
    'source_plan_archived',
    'product',
    jsonb_build_object(
      'archive_id',
      registered_archive.id,
      'size_bytes',
      registered_archive.size_bytes,
      'page_count',
      registered_archive.page_count,
      'sha256',
      registered_archive.sha256
    )
  );

  return registered_archive;
end;
$$;

revoke execute on function public.register_verified_document_archive(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.register_verified_document_archive(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  integer
) to service_role;

create or replace function public.record_document_archive_presence(
  p_archive_id uuid,
  p_present boolean,
  p_checked_at timestamptz
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  archive public.document_archives;
  updated_archive public.document_archives;
begin
  if p_archive_id is null
     or p_checked_at is null
     or p_checked_at > now() + interval '5 minutes' then
    raise exception 'The archive presence check is invalid.';
  end if;

  select document.*
  into archive
  from public.document_archives as document
  where document.id = p_archive_id
  for update;

  if archive.id is null then
    raise exception 'Document archive not found.';
  end if;

  if archive.status = 'deleted' then
    return archive;
  end if;

  if p_checked_at < archive.last_check_attempt_at then
    return archive;
  end if;

  update public.document_archives as document
  set
    integrity_status = case
      when p_present is true then 'verified'
      when p_present is false then 'missing'
      else document.integrity_status
    end,
    last_verified_at = case
      when p_present is true then p_checked_at
      else document.last_verified_at
    end,
    last_check_attempt_at = p_checked_at
  where document.id = archive.id
  returning document.* into updated_archive;

  return updated_archive;
end;
$$;

revoke execute on function public.record_document_archive_presence(
  uuid,
  boolean,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.record_document_archive_presence(
  uuid,
  boolean,
  timestamptz
) to service_role;

create or replace function public.admin_transition_document_archive(
  p_archive_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_action text,
  p_reason text
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  archive public.document_archives;
  updated_archive public.document_archives;
  before_state jsonb;
  audit_action text;
begin
  if p_archive_id is null
     or p_actor_user_id is null
     or nullif(btrim(p_actor_email), '') is null
     or p_action not in (
       'place_hold',
       'release_hold',
       'request_deletion',
       'cancel_deletion'
     )
     or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'The archive action, actor, and 5-500 character reason are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null
     or lower(coalesce(actor.email, '')) <> lower(btrim(p_actor_email)) then
    raise exception 'An active administrator is required.';
  end if;

  select document.*
  into archive
  from public.document_archives as document
  where document.id = p_archive_id
  for update;

  if archive.id is null then
    raise exception 'Document archive not found.';
  end if;

  if archive.status = 'deleted' then
    raise exception 'A deleted document archive tombstone cannot be changed.';
  end if;
  if archive.status = 'deleting' then
    raise exception 'Source-plan deletion is already in progress.';
  end if;

  before_state := jsonb_build_object(
    'status',
    archive.status,
    'legal_hold_at',
    archive.legal_hold_at,
    'deletion_requested_at',
    archive.deletion_requested_at
  );

  case p_action
    when 'place_hold' then
      if archive.legal_hold_at is not null then
        raise exception 'This source plan is already under legal hold.';
      end if;
      update public.document_archives as document
      set
        legal_hold_at = now(),
        legal_hold_reason = btrim(p_reason),
        legal_hold_by = actor.id
      where document.id = archive.id
      returning document.* into updated_archive;
      audit_action := 'document_archive.legal_hold_placed';

    when 'release_hold' then
      if archive.legal_hold_at is null then
        raise exception 'This source plan is not under legal hold.';
      end if;
      update public.document_archives as document
      set
        legal_hold_at = null,
        legal_hold_reason = null,
        legal_hold_by = null
      where document.id = archive.id
      returning document.* into updated_archive;
      audit_action := 'document_archive.legal_hold_released';

    when 'request_deletion' then
      if archive.legal_hold_at is not null then
        raise exception 'A legal hold blocks source-plan deletion.';
      end if;
      if archive.status <> 'retained' then
        raise exception 'This source plan is not eligible for a new deletion request.';
      end if;
      update public.document_archives as document
      set
        status = 'deletion_requested',
        deletion_requested_at = now(),
        deletion_request_reason = btrim(p_reason),
        deletion_requested_by = actor.id
      where document.id = archive.id
      returning document.* into updated_archive;
      audit_action := 'document_archive.deletion_requested';

    when 'cancel_deletion' then
      if archive.status <> 'deletion_requested' then
        raise exception 'This source plan has no pending deletion request.';
      end if;
      update public.document_archives as document
      set
        status = 'retained',
        deletion_requested_at = null,
        deletion_request_reason = null,
        deletion_requested_by = null
      where document.id = archive.id
      returning document.* into updated_archive;
      audit_action := 'document_archive.deletion_canceled';
  end case;

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
    actor.email,
    audit_action,
    'document_archive',
    archive.id::text,
    btrim(p_reason),
    before_state,
    jsonb_build_object(
      'status',
      updated_archive.status,
      'legal_hold_at',
      updated_archive.legal_hold_at,
      'deletion_requested_at',
      updated_archive.deletion_requested_at
    )
  );

  return updated_archive;
end;
$$;

revoke execute on function public.admin_transition_document_archive(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.admin_transition_document_archive(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

create or replace function public.begin_document_archive_deletion(
  p_archive_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  archive public.document_archives;
  claimed_archive public.document_archives;
  claim_token uuid;
  audit_action text;
begin
  if p_archive_id is null
     or p_actor_user_id is null
     or nullif(btrim(p_actor_email), '') is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'The deletion claim, actor, and 5-500 character reason are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null
     or lower(coalesce(actor.email, '')) <> lower(btrim(p_actor_email)) then
    raise exception 'An active administrator is required.';
  end if;

  select document.*
  into archive
  from public.document_archives as document
  where document.id = p_archive_id
  for update;

  if archive.id is null then
    raise exception 'Document archive not found.';
  end if;
  if archive.status = 'deleting'
     and archive.deletion_started_at >= now() - interval '15 minutes' then
    raise exception 'Source-plan deletion is already in progress.';
  end if;
  if archive.status not in ('deletion_requested', 'deleting') then
    raise exception 'A recorded deletion request is required.';
  end if;
  if archive.legal_hold_at is not null then
    raise exception 'A legal hold blocks source-plan deletion.';
  end if;
  if archive.archived_at > now() - interval '2 hours 5 minutes' then
    raise exception 'Wait until the initial signed upload window has expired before deleting this source plan.';
  end if;
  if archive.deletion_requested_by = actor.id then
    raise exception 'A second active administrator must approve source-plan deletion.';
  end if;

  claim_token := gen_random_uuid();
  audit_action := case
    when archive.status = 'deleting'
      then 'document_archive.deletion_reclaimed'
    else 'document_archive.deletion_started'
  end;

  update public.document_archives as document
  set
    status = 'deleting',
    deletion_token = claim_token,
    deletion_started_at = now(),
    deletion_approved_by = actor.id
  where document.id = archive.id
  returning document.* into claimed_archive;

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
    actor.email,
    audit_action,
    'document_archive',
    archive.id::text,
    btrim(p_reason),
    jsonb_build_object(
      'status',
      archive.status,
      'deletion_started_at',
      archive.deletion_started_at
    ),
    jsonb_build_object(
      'status',
      claimed_archive.status,
      'deletion_started_at',
      claimed_archive.deletion_started_at,
      'deletion_approved_by',
      claimed_archive.deletion_approved_by
    )
  );

  return claimed_archive;
end;
$$;

revoke execute on function public.begin_document_archive_deletion(
  uuid,
  uuid,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.begin_document_archive_deletion(
  uuid,
  uuid,
  text,
  text
) to service_role;

create or replace function public.release_document_archive_deletion(
  p_archive_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_deletion_token uuid,
  p_reason text
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  archive public.document_archives;
  released_archive public.document_archives;
begin
  if p_archive_id is null
     or p_actor_user_id is null
     or p_deletion_token is null
     or nullif(btrim(p_actor_email), '') is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500 then
    raise exception 'The deletion claim, actor, and 5-500 character reason are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null
     or lower(coalesce(actor.email, '')) <> lower(btrim(p_actor_email)) then
    raise exception 'An active administrator is required.';
  end if;

  select document.*
  into archive
  from public.document_archives as document
  where document.id = p_archive_id
  for update;

  if archive.id is null then
    raise exception 'Document archive not found.';
  end if;
  if archive.status <> 'deleting'
     or archive.deletion_token <> p_deletion_token
     or archive.deletion_approved_by <> actor.id then
    raise exception 'The source-plan deletion claim is no longer active.';
  end if;

  update public.document_archives as document
  set
    status = 'deletion_requested',
    deletion_token = null,
    deletion_started_at = null,
    deletion_approved_by = null
  where document.id = archive.id
  returning document.* into released_archive;

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
    actor.email,
    'document_archive.deletion_released',
    'document_archive',
    archive.id::text,
    btrim(p_reason),
    jsonb_build_object(
      'status',
      archive.status,
      'deletion_started_at',
      archive.deletion_started_at
    ),
    jsonb_build_object('status', released_archive.status)
  );

  return released_archive;
end;
$$;

revoke execute on function public.release_document_archive_deletion(
  uuid,
  uuid,
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.release_document_archive_deletion(
  uuid,
  uuid,
  text,
  uuid,
  text
) to service_role;

create or replace function public.finalize_document_archive_deletion(
  p_archive_id uuid,
  p_deletion_token uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_reason text,
  p_absence_verified_at timestamptz
)
returns public.document_archives
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
  archive public.document_archives;
  deleted_archive public.document_archives;
begin
  if p_archive_id is null
     or p_deletion_token is null
     or p_actor_user_id is null
     or nullif(btrim(p_actor_email), '') is null
     or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 500
     or p_absence_verified_at is null
     or p_absence_verified_at < now() - interval '15 minutes'
     or p_absence_verified_at > now() + interval '5 minutes' then
    raise exception 'Recent verified absence, actor, and deletion reason are required.';
  end if;

  select profile.*
  into actor
  from public.profiles as profile
  where profile.id = p_actor_user_id
    and profile.role = 'admin'
    and profile.status = 'active';

  if actor.id is null
     or lower(coalesce(actor.email, '')) <> lower(btrim(p_actor_email)) then
    raise exception 'An active administrator is required.';
  end if;

  select document.*
  into archive
  from public.document_archives as document
  where document.id = p_archive_id
  for update;

  if archive.id is null then
    raise exception 'Document archive not found.';
  end if;
  if archive.status <> 'deleting'
     or archive.deletion_token <> p_deletion_token
     or archive.deletion_approved_by <> actor.id then
    raise exception 'The source-plan deletion claim is no longer active.';
  end if;
  if archive.legal_hold_at is not null then
    raise exception 'A legal hold blocks source-plan deletion.';
  end if;
  if archive.deletion_requested_by = actor.id then
    raise exception 'A second active administrator must approve source-plan deletion.';
  end if;

  update public.document_archives as document
  set
    status = 'deleted',
    integrity_status = 'missing',
    last_check_attempt_at = greatest(
      document.last_check_attempt_at,
      p_absence_verified_at
    ),
    deletion_token = null,
    deleted_at = now(),
    deletion_reason = btrim(p_reason)
  where document.id = archive.id
  returning document.* into deleted_archive;

  update public.admin_alerts as alert
  set
    status = 'resolved',
    resolved_at = now(),
    last_seen_at = now()
  where alert.dedupe_key =
      'document-archive-missing:' || archive.id::text
    and alert.status in ('open', 'acknowledged');

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
    actor.email,
    'document_archive.deletion_finalized',
    'document_archive',
    archive.id::text,
    btrim(p_reason),
    jsonb_build_object(
      'status',
      archive.status,
      'legal_hold_at',
      archive.legal_hold_at
    ),
    jsonb_build_object(
      'status',
      deleted_archive.status,
      'deleted_at',
      deleted_archive.deleted_at
    ),
    jsonb_build_object(
      'bucket',
      archive.bucket,
      'storage_path',
      archive.storage_path,
      'absence_verified_at',
      p_absence_verified_at
    )
  );

  return deleted_archive;
end;
$$;

revoke execute on function public.finalize_document_archive_deletion(
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.finalize_document_archive_deletion(
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) to service_role;

create or replace function public.get_document_archive_metrics(
  p_verification_before timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total',
    count(*),
    'registered',
    count(*) filter (where archive.status <> 'deleted'),
    'stored',
    count(*) filter (
      where archive.status <> 'deleted'
        and archive.integrity_status = 'verified'
    ),
    'storageBytes',
    coalesce(
      sum(archive.size_bytes) filter (
        where archive.status <> 'deleted'
          and archive.integrity_status = 'verified'
      ),
      0
    ),
    'protected',
    count(*) filter (where archive.status <> 'deleted'),
    'legalHold',
    count(*) filter (where archive.legal_hold_at is not null),
    'deletionRequested',
    count(*) filter (
      where archive.status in ('deletion_requested', 'deleting')
    ),
    'missing',
    count(*) filter (
      where archive.status <> 'deleted'
        and archive.integrity_status = 'missing'
    ),
    'overdueVerification',
    count(*) filter (
      where archive.status <> 'deleted'
        and archive.last_verified_at < p_verification_before
    )
  )
  from public.document_archives as archive;
$$;

revoke execute on function public.get_document_archive_metrics(timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_document_archive_metrics(timestamptz)
  to service_role;

update public.app_settings
set
  description =
    'Days to keep generated deliverables and disposable processing files after a job is completed, failed, or canceled. Verified originals are retained separately.',
  updated_at = now()
where key = 'retention.project_files_days';

comment on column public.takeoff_jobs.project_files_purged_at is
  'Set after scheduled generated/working-file cleanup is complete; a verified original and its source archive registry may remain.';
comment on column public.takeoff_jobs.upload_cleanup_completed_at is
  'Set after abandoned-upload working objects are removed while any registered source archive remains protected; prevents old cleanup jobs from starving later batches.';

comment on table public.document_archives is
  'Service-managed registry for verified original source-plan PDFs retained in private Storage independently of generated-file cleanup.';
comment on column public.document_archives.sha256 is
  'SHA-256 calculated from the verified original upload before any free-sample page extraction.';
comment on column public.document_archives.status is
  'Secure retention lifecycle (retained, deletion requested, deletion in progress, or deleted); legal hold and integrity are tracked independently.';
comment on column public.document_archives.integrity_status is
  'Independent object-presence state so integrity checks cannot erase a legal hold or deletion request.';
comment on column public.document_archives.last_verified_at is
  'Last time the source object was confirmed present; registration also verifies the original PDF bytes and checksum.';
comment on column public.document_archives.last_check_attempt_at is
  'Last presence-check attempt, advanced even on provider errors so one failing object cannot starve later archive checks.';
comment on function public.guard_document_archive_tombstone() is
  'Prevents registry deletion and makes source identity/checksum metadata immutable; explicit erasure ends in a permanent deleted tombstone.';
comment on function public.register_verified_document_archive(
  uuid,
  uuid,
  uuid,
  uuid,
  bigint,
  text,
  integer
) is
  'Service-role-only, fail-closed registration of the verified original PDF while the takeoff verification claim is locked.';
comment on function public.get_document_archive_metrics(timestamptz) is
  'Service-role-only full-population source archive counts and stored bytes for the admin control panel.';
comment on function public.admin_transition_document_archive(
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Service-role-only, active-admin-verified, atomic legal-hold and deletion-request transition with an audit record.';
comment on function public.record_document_archive_presence(
  uuid,
  boolean,
  timestamptz
) is
  'Service-role-only presence result writer; null presence records an attempted provider check without changing integrity.';
comment on function public.begin_document_archive_deletion(
  uuid,
  uuid,
  text,
  text
) is
  'Service-role-only second-admin deletion lease; atomically blocks hold/cancel races before exact-path Storage removal and supports stale-lease recovery.';
comment on function public.release_document_archive_deletion(
  uuid,
  uuid,
  text,
  uuid,
  text
) is
  'Service-role-only release of an active token-bound deletion lease when the source object is confirmed to remain present.';
comment on function public.finalize_document_archive_deletion(
  uuid,
  uuid,
  uuid,
  text,
  text,
  timestamptz
) is
  'Service-role-only token-bound tombstone finalization after recent external exact-path absence verification, blocked by any legal hold and atomic with audit.';
