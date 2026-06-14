-- ============================================================================
-- OPC Console — initial schema
-- 11 tables + RLS policies + new-user trigger.
-- Safe to run with `supabase db push`.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto on older Postgres; it's built-in on
-- recent versions but the extension is idempotent and harmless either way.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. workspaces
-- ----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. workspace_members
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'owner',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. businesses
-- ----------------------------------------------------------------------------
create table if not exists public.businesses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text,
  kind         text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. signals
-- ----------------------------------------------------------------------------
create table if not exists public.signals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete set null,
  source       text,
  title        text,
  body         text,
  status       text not null default 'new' check (status in ('new','triaged','archived')),
  external_ref text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. tasks
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete set null,
  title        text,
  notes        text,
  status       text not null default 'open' check (status in ('open','doing','done')),
  due_at       timestamptz,
  priority     int not null default 0,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. obligations
-- ----------------------------------------------------------------------------
create table if not exists public.obligations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete set null,
  title        text,
  kind         text,
  recur_rule   text,
  next_due_at  timestamptz,
  lead_days    int not null default 7,
  last_done_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. decisions
-- ----------------------------------------------------------------------------
create table if not exists public.decisions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_id  uuid references public.businesses(id) on delete set null,
  title        text,
  body         text,
  decided_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. workspace_settings
-- ----------------------------------------------------------------------------
create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  ai_provider  text,
  ai_api_key   text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 9. briefs
-- ----------------------------------------------------------------------------
create table if not exists public.briefs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  content      text,
  for_date     date,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 10. agents
-- ----------------------------------------------------------------------------
create table if not exists public.agents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text,
  system_prompt text,
  model         text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 11. agent_runs
-- ----------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id     uuid not null references public.agents(id) on delete cascade,
  input        text,
  output       text,
  status       text not null default 'pending',
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helpful indexes (workspace scoping + foreign keys).
-- ----------------------------------------------------------------------------
create index if not exists idx_workspace_members_user      on public.workspace_members(user_id);
create index if not exists idx_businesses_workspace        on public.businesses(workspace_id);
create index if not exists idx_signals_workspace           on public.signals(workspace_id);
create index if not exists idx_tasks_workspace             on public.tasks(workspace_id);
create index if not exists idx_obligations_workspace       on public.obligations(workspace_id);
create index if not exists idx_decisions_workspace         on public.decisions(workspace_id);
create index if not exists idx_briefs_workspace            on public.briefs(workspace_id);
create index if not exists idx_agents_workspace            on public.agents(workspace_id);
create index if not exists idx_agent_runs_workspace        on public.agent_runs(workspace_id);
create index if not exists idx_agent_runs_agent            on public.agent_runs(agent_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.businesses        enable row level security;
alter table public.signals           enable row level security;
alter table public.tasks             enable row level security;
alter table public.obligations       enable row level security;
alter table public.decisions         enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.briefs            enable row level security;
alter table public.agents            enable row level security;
alter table public.agent_runs        enable row level security;

-- ---- workspace_members: a user sees / manages only their own membership rows
drop policy if exists workspace_members_rw on public.workspace_members;
create policy workspace_members_rw on public.workspace_members
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---- workspaces: visible if the user is a member
drop policy if exists workspaces_rw on public.workspaces;
create policy workspaces_rw on public.workspaces
  for all
  using (
    id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  )
  with check (
    id in (
      select workspace_id from public.workspace_members where user_id = auth.uid()
    )
  );

-- ---- All other tables: scoped to the caller's workspaces.
-- A single FOR ALL policy per table covers select/insert/update/delete.

-- businesses
drop policy if exists businesses_rw on public.businesses;
create policy businesses_rw on public.businesses
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- signals
drop policy if exists signals_rw on public.signals;
create policy signals_rw on public.signals
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- tasks
drop policy if exists tasks_rw on public.tasks;
create policy tasks_rw on public.tasks
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- obligations
drop policy if exists obligations_rw on public.obligations;
create policy obligations_rw on public.obligations
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- decisions
drop policy if exists decisions_rw on public.decisions;
create policy decisions_rw on public.decisions
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- workspace_settings
drop policy if exists workspace_settings_rw on public.workspace_settings;
create policy workspace_settings_rw on public.workspace_settings
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- briefs
drop policy if exists briefs_rw on public.briefs;
create policy briefs_rw on public.briefs
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- agents
drop policy if exists agents_rw on public.agents;
create policy agents_rw on public.agents
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- agent_runs
drop policy if exists agent_runs_rw on public.agent_runs;
create policy agent_runs_rw on public.agent_runs
  for all
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- ============================================================================
-- New-user bootstrap trigger.
-- On every new auth.users row, create:
--   * a workspace named after the email prefix
--   * an owner membership
--   * a workspace_settings row
-- SECURITY DEFINER so it bypasses RLS during signup.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  ws_name text;
begin
  -- Derive a friendly workspace name from the email prefix.
  ws_name := coalesce(split_part(new.email, '@', 1), 'My Workspace');

  insert into public.workspaces (name)
  values (ws_name)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into public.workspace_settings (workspace_id)
  values (new_workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
