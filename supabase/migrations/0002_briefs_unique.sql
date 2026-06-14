-- ============================================================================
-- OPC Console — add UNIQUE (workspace_id, for_date) to briefs
--
-- The application upserts briefs with onConflict: 'workspace_id,for_date'
-- (one brief per workspace per calendar day) from both the on-demand
-- Server Action and the daily-brief cron route. Postgres requires a matching
-- unique constraint for ON CONFLICT to resolve; without it the upsert errors.
--
-- This migration is additive and idempotent; it does NOT modify 0001_init.sql.
-- Safe to run with `supabase db push`.
-- ============================================================================

-- Collapse any pre-existing duplicates (keep the most recent row per
-- workspace/date) so the unique constraint can be added without failure.
-- Rows with a null for_date are left untouched (the constraint allows nulls).
delete from public.briefs b
using public.briefs newer
where b.workspace_id = newer.workspace_id
  and b.for_date    = newer.for_date
  and b.for_date is not null
  and b.created_at  < newer.created_at;

-- Add the constraint only if it does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'briefs_workspace_date_unique'
      and conrelid = 'public.briefs'::regclass
  ) then
    alter table public.briefs
      add constraint briefs_workspace_date_unique unique (workspace_id, for_date);
  end if;
end $$;
