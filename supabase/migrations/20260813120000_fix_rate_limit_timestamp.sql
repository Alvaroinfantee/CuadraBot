begin;

-- `current_time` is a PostgreSQL special value with type `timetz`. Using it as
-- a PL/pgSQL variable name caused the insert below to resolve the special value
-- instead of the declared `timestamptz`, disabling every protected endpoint.
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
  request_timestamp timestamptz := clock_timestamp();
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
    request_timestamp,
    1,
    request_timestamp
  )
  on conflict (bucket_key)
  do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at
        <= request_timestamp - rate_window
        then request_timestamp
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at
        <= request_timestamp - rate_window
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = request_timestamp
  returning * into bucket;

  retry_after_seconds := greatest(
    0,
    ceil(
      extract(
        epoch from (
          bucket.window_started_at + rate_window - request_timestamp
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

comment on function public.consume_api_rate_limit(text, integer, integer) is
  'Service-role-only atomic fixed-window request limiter.';

commit;
