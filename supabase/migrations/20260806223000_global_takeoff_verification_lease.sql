begin;

-- PDF verification is streamed to a private temporary file and inspected by a
-- resource-limited qpdf subprocess. Serialize that bounded CPU/memory section
-- across every app instance. The transaction-scoped advisory lock
-- closes the race between counting an active claim and creating the next one;
-- the existing 15-minute job lease recovers automatically after a crashed
-- request.
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
  active_verifications integer;
begin
  if p_job_id is null or p_user_id is null then
    raise exception 'A takeoff job and customer are required.';
  end if;

  -- A fixed application-specific key makes admission global even when App
  -- Platform has more than one web process. The lock is released when this
  -- RPC transaction commits or rolls back.
  perform pg_catalog.pg_advisory_xact_lock(714447509259848101::bigint);

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

  select count(*)::integer
  into active_verifications
  from public.takeoff_jobs as takeoff_job
  where takeoff_job.verification_token is not null
    and takeoff_job.verification_started_at > now() - interval '15 minutes'
    and takeoff_job.id <> job.id;

  if active_verifications >= 1 then
    raise exception 'Plan verification capacity is busy.';
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

revoke execute on function public.begin_takeoff_verification(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.begin_takeoff_verification(uuid, uuid)
to service_role;

comment on function public.begin_takeoff_verification(uuid, uuid) is
  'Service-role-only global lease for isolated PDF verification; one active 15-minute claim is allowed across all app instances.';

commit;
