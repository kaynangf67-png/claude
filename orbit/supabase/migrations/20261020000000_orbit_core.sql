-- ORBIT core schema
--
-- Access model:
--   * Reads from the browser/server components use the user's JWT and are
--     constrained by RLS to organizations the user belongs to.
--   * Every write goes through server code (service role) after explicit
--     authorization checks. Authenticated users get SELECT-only policies, so
--     a leaked anon key cannot be used to change missions, approvals or logs.
--   * Secrets (OAuth tokens) live in tables with no grants for anon/authenticated.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  notify_approvals boolean not null default true,
  notify_failures boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.org_policies (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  version integer not null default 1 check (version > 0),
  execution_paused boolean not null default false,
  require_plan_review boolean not null default true,
  require_distinct_approver boolean not null default false,
  max_actions_per_mission integer not null default 20 check (max_actions_per_mission between 1 and 200),
  max_task_duration_ms integer not null default 30000 check (max_task_duration_ms between 1000 and 300000),
  monthly_ai_budget_usd numeric(10, 2) not null default 10 check (monthly_ai_budget_usd >= 0),
  missions_per_hour integer not null default 20 check (missions_per_hour between 1 and 1000),
  approval_ttl_hours integer not null default 72 check (approval_ttl_hours between 1 and 720),
  tool_modes jsonb not null default '{}'::jsonb check (jsonb_typeof(tool_modes) = 'object'),
  email_allowed_domains text[] not null default '{}',
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Missions, tasks, approvals, execution evidence
-- ---------------------------------------------------------------------------

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  name text not null check (char_length(name) between 2 and 120),
  objective text not null check (char_length(objective) between 3 and 4000),
  status text not null default 'draft' check (status in ('draft', 'planning', 'awaiting_approval', 'queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  plan jsonb,
  plan_source text check (plan_source in ('ai', 'manual', 'edited')),
  plan_review jsonb,
  report jsonb,
  action_count integer not null default 0 check (action_count >= 0),
  lock_token uuid,
  locked_until timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index missions_org_created_idx on public.missions (org_id, created_at desc);
create index missions_org_status_idx on public.missions (org_id, status);
create index missions_runnable_idx on public.missions (locked_until) where status in ('queued', 'running');
create index missions_created_by_idx on public.missions (created_by);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  key text not null,
  title text not null,
  description text not null default '',
  agent_role text not null check (agent_role in ('strategist', 'operator', 'auditor', 'optimizer')),
  tool_id text not null,
  params jsonb not null default '{}'::jsonb,
  depends_on text[] not null default '{}',
  expected_outcome text not null default '',
  status text not null default 'pending' check (status in ('pending', 'ready', 'running', 'awaiting_approval', 'succeeded', 'failed', 'skipped', 'cancelled', 'verification_failed')),
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  requires_approval boolean not null default false,
  approval_id uuid,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  output jsonb,
  error_code text,
  error_message text,
  verification_status text not null default 'pending' check (verification_status in ('verified', 'unverified', 'failed', 'not_applicable', 'pending')),
  verification_detail jsonb,
  next_attempt_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, key)
);
create index tasks_org_status_idx on public.tasks (org_id, status);
create index tasks_org_updated_idx on public.tasks (org_id, updated_at desc);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  tool_id text not null,
  params jsonb not null,
  binding_hash text not null check (char_length(binding_hash) = 64),
  policy_version integer not null,
  requested_by uuid not null references auth.users (id),
  risk text not null check (risk in ('low', 'medium', 'high', 'critical')),
  reason text not null default '',
  impact text not null default '',
  target text not null default '',
  evidence jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'invalidated', 'cancelled', 'consumed')),
  expires_at timestamptz not null,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  created_at timestamptz not null default now()
);
create index approvals_org_status_idx on public.approvals (org_id, status, created_at desc);
create index approvals_task_idx on public.approvals (task_id);
create index approvals_mission_idx on public.approvals (mission_id);

alter table public.tasks
  add constraint tasks_approval_fk foreign key (approval_id) references public.approvals (id) on delete set null;
create index tasks_mission_idx on public.tasks (mission_id);
create index tasks_approval_idx on public.tasks (approval_id);

create table public.tool_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  tool_id text not null,
  idempotency_key text not null,
  attempt integer not null check (attempt >= 1),
  status text not null check (status in ('started', 'succeeded', 'failed')),
  input jsonb not null,
  output jsonb,
  evidence jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  verification_status text not null default 'pending' check (verification_status in ('verified', 'unverified', 'failed', 'not_applicable', 'pending')),
  verification_checks jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (org_id, idempotency_key)
);
create index tool_executions_mission_idx on public.tool_executions (mission_id);
create index tool_executions_task_idx on public.tool_executions (task_id);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  role text not null check (role in ('strategist', 'operator', 'auditor', 'optimizer')),
  kind text not null check (kind in ('plan', 'execute', 'verify', 'optimize')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  input_summary text not null default '',
  output jsonb,
  error text,
  model text,
  input_tokens integer,
  output_tokens integer,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index agent_runs_org_role_idx on public.agent_runs (org_id, role, started_at desc);
create index agent_runs_mission_idx on public.agent_runs (mission_id);
create index agent_runs_task_idx on public.agent_runs (task_id);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete set null,
  agent_run_id uuid references public.agent_runs (id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  -- null = model price unknown; never estimated by guessing
  cost_usd numeric(12, 6),
  created_at timestamptz not null default now()
);
create index usage_records_org_created_idx on public.usage_records (org_id, created_at desc);
create index usage_records_mission_idx on public.usage_records (mission_id);
create index usage_records_run_idx on public.usage_records (agent_run_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  outcome text not null check (outcome in ('success', 'failure', 'denied', 'info')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (org_id, created_at desc);
create index audit_logs_org_action_idx on public.audit_logs (org_id, action);
create index audit_logs_entity_idx on public.audit_logs (entity_id);

-- Audit history is append-only for everyone, including the service role.
create function private.audit_logs_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function private.audit_logs_immutable();
create trigger audit_logs_no_truncate before truncate on public.audit_logs
  for each statement execute function private.audit_logs_immutable();

-- ---------------------------------------------------------------------------
-- Integrations
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('gmail')),
  status text not null check (status in ('connected', 'disconnected', 'error')),
  account_email text,
  scopes text[] not null default '{}',
  connected_by uuid references auth.users (id),
  connected_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

-- Encrypted (AES-256-GCM, app-level key) OAuth tokens. RLS on, no policies and
-- no grants for anon/authenticated: only the service role can reach them.
create table public.integration_secrets (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

create table public.oauth_states (
  state text primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  code_verifier text not null,
  expires_at timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Business data the tools operate on
-- ---------------------------------------------------------------------------

create table public.records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('customer_message', 'note', 'contact', 'order')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  sender text check (sender is null or char_length(sender) <= 200),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  classification jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index records_org_kind_status_idx on public.records (org_id, kind, status, created_at desc);
create index records_created_by_idx on public.records (created_by);

create table public.work_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  related_record_id uuid references public.records (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  idempotency_key text not null,
  created_by_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);
create index work_items_org_created_idx on public.work_items (org_id, created_at desc);
create index work_items_record_idx on public.work_items (related_record_id);
create index work_items_task_idx on public.work_items (created_by_task_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  scope text not null,
  content jsonb not null,
  checksum text not null,
  idempotency_key text not null,
  created_by_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);
create index reports_org_created_idx on public.reports (org_id, created_at desc);
create index reports_task_idx on public.reports (created_by_task_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations', 'profiles', 'org_policies', 'missions', 'tasks', 'integrations', 'records'] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create function private.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

revoke all on function private.is_org_member(uuid) from public;
revoke all on function private.has_org_role(uuid, text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members read their org; nobody writes from the client.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.org_policies enable row level security;
alter table public.missions enable row level security;
alter table public.tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.tool_executions enable row level security;
alter table public.agent_runs enable row level security;
alter table public.usage_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integrations enable row level security;
alter table public.records enable row level security;
alter table public.work_items enable row level security;
alter table public.reports enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.oauth_states enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using ((select private.is_org_member(id)));

create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

create policy memberships_select on public.memberships for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy org_policies_select on public.org_policies for select to authenticated
  using ((select private.is_org_member(org_id)));

create policy missions_select on public.missions for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy tasks_select on public.tasks for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy approvals_select on public.approvals for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy tool_executions_select on public.tool_executions for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy agent_runs_select on public.agent_runs for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy integrations_select on public.integrations for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy records_select on public.records for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy work_items_select on public.work_items for select to authenticated
  using ((select private.is_org_member(org_id)));
create policy reports_select on public.reports for select to authenticated
  using ((select private.is_org_member(org_id)));

-- Cost and audit data: admins and owners only.
create policy usage_records_select on public.usage_records for select to authenticated
  using ((select private.has_org_role(org_id, array['owner', 'admin'])));
create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select private.is_org_member(org_id)));

-- Table privileges: SELECT only for authenticated, nothing for anon.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke all on public.integration_secrets, public.oauth_states from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Engine RPCs (service role only)
-- ---------------------------------------------------------------------------

create function public.orbit_acquire_mission_lock(p_org uuid, p_mission uuid, p_token uuid, p_ttl_ms integer)
returns boolean language sql security invoker set search_path = '' as $$
  with updated as (
    update public.missions
       set lock_token = p_token,
           locked_until = now() + make_interval(secs => p_ttl_ms / 1000.0)
     where id = p_mission and org_id = p_org
       and (lock_token is null or locked_until is null or locked_until < now())
    returning 1
  )
  select exists (select 1 from updated);
$$;

create function public.orbit_release_mission_lock(p_org uuid, p_mission uuid, p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.missions set lock_token = null, locked_until = null
   where id = p_mission and org_id = p_org and lock_token = p_token;
$$;

create function public.orbit_increment_action_count(p_org uuid, p_mission uuid)
returns integer language sql security invoker set search_path = '' as $$
  update public.missions set action_count = action_count + 1
   where id = p_mission and org_id = p_org
  returning action_count;
$$;

create function public.orbit_usage_cost_since(p_org uuid, p_since timestamptz)
returns numeric language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(cost_usd), 0) from public.usage_records where org_id = p_org and created_at >= p_since;
$$;

create function public.orbit_mission_usage(p_org uuid, p_mission uuid)
returns table (record_count bigint, unknown_cost bigint, cost numeric)
language sql stable security invoker set search_path = '' as $$
  select count(*), count(*) filter (where cost_usd is null), coalesce(sum(cost_usd), 0)
    from public.usage_records where org_id = p_org and mission_id = p_mission;
$$;

-- Creates an organization with its owner membership and default policy atomically.
create function public.orbit_create_organization(p_user uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_org uuid;
begin
  insert into public.organizations (name, created_by) values (p_name, p_user) returning id into v_org;
  insert into public.memberships (org_id, user_id, role) values (v_org, p_user, 'owner');
  insert into public.org_policies (org_id, updated_by) values (v_org, p_user);
  return v_org;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'orbit_acquire_mission_lock(uuid, uuid, uuid, integer)',
    'orbit_release_mission_lock(uuid, uuid, uuid)',
    'orbit_increment_action_count(uuid, uuid)',
    'orbit_usage_cost_since(uuid, timestamptz)',
    'orbit_mission_usage(uuid, uuid)',
    'orbit_create_organization(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
-- Belt and braces on top of the trigger.
revoke update, delete, truncate on public.audit_logs from service_role;
