begin;

-- Queue dispatch must be one atomic operation. Selecting a candidate in the
-- application and claiming it in a later request lets workers race on the
-- same row and makes text ordering put "standard" ahead of "rush". Keep one
-- active claim per worker so a lost HTTP response or worker restart resumes
-- the current lease instead of consuming another job attempt.
create or replace function public.claim_next_takeoff_job(
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
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'A worker ID is required.';
  end if;

  -- Serialize concurrent polls from the same worker identity. Row locks alone
  -- would let two simultaneous transactions skip one another and claim two
  -- different jobs for a single-threaded worker.
  perform pg_catalog.pg_advisory_xact_lock(
    714447510,
    pg_catalog.hashtext(p_worker_id)
  );

  select takeoff_job.*
  into claimed
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.status = 'processing'
    and takeoff_job.claimed_by = p_worker_id
  order by
    takeoff_job.claimed_at asc nulls last,
    takeoff_job.created_at asc,
    takeoff_job.id asc
  limit 1
  for update;

  if claimed.id is not null then
    return claimed;
  end if;

  with candidate as (
    select takeoff_job.id
    from public.takeoff_jobs as takeoff_job
    where takeoff_job.status = 'queued'
      and takeoff_job.claimed_by is null
      and takeoff_job.attempt_count < takeoff_job.max_attempts
    order by
      case
        when takeoff_job.free_sample is false
          and takeoff_job.priority = 'rush' then 0
        when takeoff_job.free_sample is false
          and takeoff_job.priority = 'standard' then 1
        else 2
      end,
      takeoff_job.queued_at asc nulls last,
      takeoff_job.created_at asc,
      takeoff_job.id asc
    limit 1
    for update skip locked
  )
  update public.takeoff_jobs as takeoff_job
  set
    status = 'processing',
    claimed_by = p_worker_id,
    claim_token = gen_random_uuid(),
    claimed_at = now(),
    processing_started_at = coalesce(
      takeoff_job.processing_started_at,
      now()
    ),
    attempt_count = takeoff_job.attempt_count + 1
  from candidate
  where takeoff_job.id = candidate.id
    and takeoff_job.status = 'queued'
    and takeoff_job.claimed_by is null
    and takeoff_job.attempt_count < takeoff_job.max_attempts
  returning takeoff_job.* into claimed;

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

-- The worker version deployed with this migration still acknowledges the ID
-- returned by the next-job endpoint through claim_takeoff_job. Make that
-- acknowledgement idempotent without rotating the lease or incrementing the
-- attempt count a second time.
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

  select takeoff_job.*
  into claimed
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.id = p_job_id
    and takeoff_job.status = 'processing'
    and takeoff_job.claimed_by = p_worker_id
  for update;

  if claimed.id is not null then
    return claimed;
  end if;

  update public.takeoff_jobs as takeoff_job
  set
    status = 'processing',
    claimed_by = p_worker_id,
    claim_token = gen_random_uuid(),
    claimed_at = now(),
    processing_started_at = coalesce(
      takeoff_job.processing_started_at,
      now()
    ),
    attempt_count = takeoff_job.attempt_count + 1
  where takeoff_job.id = p_job_id
    and takeoff_job.status = 'queued'
    and takeoff_job.claimed_by is null
    and takeoff_job.attempt_count < takeoff_job.max_attempts
  returning takeoff_job.* into claimed;

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

create index if not exists takeoff_jobs_dispatch_priority_idx
  on public.takeoff_jobs (
    (
      case
        when free_sample is false and priority = 'rush' then 0
        when free_sample is false and priority = 'standard' then 1
        else 2
      end
    ),
    queued_at,
    created_at,
    id
  )
  where status = 'queued'
    and claimed_by is null
    and attempt_count < max_attempts;

revoke execute on function public.claim_next_takeoff_job(text)
  from public, anon, authenticated;
grant execute on function public.claim_next_takeoff_job(text)
  to service_role;

revoke execute on function public.claim_takeoff_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_takeoff_job(uuid, text)
  to service_role;

comment on function public.claim_next_takeoff_job(text) is
  'Service-role-only atomic queue claim. Resumes a worker lease first, then orders rush paid, standard paid, and free-sample jobs by queued time.';

commit;
