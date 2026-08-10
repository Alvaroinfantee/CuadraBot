begin;

do $$
begin
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

commit;
