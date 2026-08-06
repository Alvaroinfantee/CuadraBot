-- Align the public draft scope with the processor's actual two capabilities:
-- discrete legend-mapped counts and scaled cable/conduit runs. Older values
-- remain valid so historical jobs continue to render and reconcile.

alter table public.takeoff_jobs
  drop constraint if exists takeoff_jobs_trades_check;

alter table public.takeoff_jobs
  add constraint takeoff_jobs_trades_check check (
    trades <@ array[
      'flooring_finishes',
      'drywall_partitions_ceilings',
      'doors_windows_openings',
      'electrical_fixtures',
      'other_legend_devices',
      'fixture_device_counts',
      'cable_conduit_runs'
    ]::text[]
    and cardinality(trades) <= 3
    and (status = 'draft' or cardinality(trades) between 1 and 3)
    and cardinality(trades) = (
      (case when 'flooring_finishes' = any(trades) then 1 else 0 end)
      + (case when 'drywall_partitions_ceilings' = any(trades) then 1 else 0 end)
      + (case when 'doors_windows_openings' = any(trades) then 1 else 0 end)
      + (case when 'electrical_fixtures' = any(trades) then 1 else 0 end)
      + (case when 'other_legend_devices' = any(trades) then 1 else 0 end)
      + (case when 'fixture_device_counts' = any(trades) then 1 else 0 end)
      + (case when 'cable_conduit_runs' = any(trades) then 1 else 0 end)
    )
  );

comment on constraint takeoff_jobs_trades_check on public.takeoff_jobs is
  'Allows the canonical fixture/device count and cable/conduit run scopes plus historical values; rejects duplicates and limits each job to three stored scopes.';
