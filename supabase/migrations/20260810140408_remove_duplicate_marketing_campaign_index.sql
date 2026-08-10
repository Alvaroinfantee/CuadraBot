begin;

-- The pre-release production schema used a different name for this exact
-- index. Keep the canonical index installed by the upgrade migration.
drop index if exists public.marketing_events_campaign_occurred_at_idx;

commit;
