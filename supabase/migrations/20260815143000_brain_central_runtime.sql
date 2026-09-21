-- Brain central runtime: conversaciones, ejecucion durable, aprobaciones y telemetria.
-- Migracion aditiva. Conserva brain_runs historicos como kind = 'analysis'.

create table if not exists public.brain_conversations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null,
  channel text not null default 'internal',
  title text,
  state jsonb not null default '{}'::jsonb,
  last_message_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_conversations_channel_check
    check (channel in ('bar', 'brain', 'internal', 'customer', 'api', 'automation')),
  constraint brain_conversations_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint brain_conversations_id_empresa_unique unique (id, empresa_id)
);

drop trigger if exists set_brain_conversations_updated_at on public.brain_conversations;
create trigger set_brain_conversations_updated_at
before update on public.brain_conversations
for each row execute function public.set_updated_at();

create index if not exists brain_conversations_owner_last_idx
  on public.brain_conversations (empresa_id, profile_id, last_message_at desc);

alter table public.brain_runs add column if not exists kind text not null default 'analysis';
alter table public.brain_runs add column if not exists conversation_id uuid;
alter table public.brain_runs add column if not exists initiated_by uuid;
alter table public.brain_runs add column if not exists request jsonb not null default '{}'::jsonb;
alter table public.brain_runs add column if not exists response jsonb not null default '{}'::jsonb;
alter table public.brain_runs add column if not exists current_step integer not null default 0;
alter table public.brain_runs add column if not exists idempotency_key text;
alter table public.brain_runs add column if not exists workflow_run_id text;
alter table public.brain_runs add column if not exists retry_count integer not null default 0;

alter table public.brain_runs drop constraint if exists brain_runs_status_check;
alter table public.brain_runs add constraint brain_runs_status_check
  check (status in (
    'queued', 'running', 'waiting_approval', 'retrying', 'completed',
    'failed', 'cancelled', 'denied'
  ));
alter table public.brain_runs drop constraint if exists brain_runs_source_check;
alter table public.brain_runs add constraint brain_runs_source_check
  check (source in ('manual', 'scheduled', 'system', 'bar', 'brain', 'api', 'automation', 'customer'));
alter table public.brain_runs drop constraint if exists brain_runs_kind_check;
alter table public.brain_runs add constraint brain_runs_kind_check
  check (kind in ('analysis', 'conversation', 'tool', 'workflow', 'automation'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brain_runs_conversation_empresa_fkey'
  ) then
    alter table public.brain_runs
      add constraint brain_runs_conversation_empresa_fkey
      foreign key (conversation_id, empresa_id)
      references public.brain_conversations(id, empresa_id)
      on delete set null (conversation_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'brain_runs_initiated_by_empresa_fkey'
  ) then
    alter table public.brain_runs
      add constraint brain_runs_initiated_by_empresa_fkey
      foreign key (initiated_by, empresa_id)
      references public.profiles(id, empresa_id)
      on delete set null (initiated_by);
  end if;
end $$;

create unique index if not exists brain_runs_idempotency_unique
  on public.brain_runs (empresa_id, idempotency_key)
  where idempotency_key is not null;
create index if not exists brain_runs_conversation_created_idx
  on public.brain_runs (empresa_id, conversation_id, created_at desc);

create table if not exists public.brain_messages (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversation_id uuid not null,
  profile_id uuid not null,
  message_id text not null,
  role text not null,
  content jsonb not null,
  sequence bigint generated always as identity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_messages_role_check check (role in ('system', 'user', 'assistant', 'tool')),
  constraint brain_messages_conversation_empresa_fkey
    foreign key (conversation_id, empresa_id)
    references public.brain_conversations(id, empresa_id)
    on delete cascade,
  constraint brain_messages_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint brain_messages_conversation_message_unique unique (conversation_id, message_id)
);

drop trigger if exists set_brain_messages_updated_at on public.brain_messages;
create trigger set_brain_messages_updated_at
before update on public.brain_messages
for each row execute function public.set_updated_at();

create index if not exists brain_messages_conversation_sequence_idx
  on public.brain_messages (empresa_id, conversation_id, sequence);

create table if not exists public.brain_run_steps (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid not null,
  step_id text not null,
  tool_name text,
  status text not null default 'queued',
  attempt integer not null default 1,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint brain_run_steps_status_check
    check (status in ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'denied', 'skipped')),
  constraint brain_run_steps_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete cascade,
  constraint brain_run_steps_run_step_unique unique (run_id, step_id)
);

create index if not exists brain_run_steps_run_idx
  on public.brain_run_steps (empresa_id, run_id, created_at);

create table if not exists public.brain_run_events (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint brain_run_events_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete cascade
);

create index if not exists brain_run_events_run_idx
  on public.brain_run_events (empresa_id, run_id, id);

create table if not exists public.brain_approvals (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversation_id uuid not null,
  run_id uuid,
  approval_id text not null,
  tool_call_id text,
  tool_name text not null,
  risk text not null,
  status text not null default 'pending',
  request jsonb not null default '{}'::jsonb,
  decision_reason text,
  requested_by uuid not null,
  decided_by uuid,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint brain_approvals_risk_check check (risk in ('low', 'medium', 'high', 'critical')),
  constraint brain_approvals_status_check check (status in ('pending', 'approved', 'denied', 'expired')),
  constraint brain_approvals_conversation_empresa_fkey
    foreign key (conversation_id, empresa_id)
    references public.brain_conversations(id, empresa_id)
    on delete cascade,
  constraint brain_approvals_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete set null (run_id),
  constraint brain_approvals_requested_by_empresa_fkey
    foreign key (requested_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint brain_approvals_decided_by_empresa_fkey
    foreign key (decided_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (decided_by),
  constraint brain_approvals_external_id_unique unique (empresa_id, approval_id)
);

create index if not exists brain_approvals_pending_idx
  on public.brain_approvals (empresa_id, status, requested_at desc);

create table if not exists public.brain_usage_events (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid,
  conversation_id uuid,
  run_id uuid,
  provider text,
  model text,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  duration_ms integer,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint brain_usage_events_conversation_empresa_fkey
    foreign key (conversation_id, empresa_id)
    references public.brain_conversations(id, empresa_id)
    on delete set null (conversation_id),
  constraint brain_usage_events_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete set null (run_id),
  constraint brain_usage_events_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (profile_id)
);

create index if not exists brain_usage_events_created_idx
  on public.brain_usage_events (empresa_id, created_at desc);

create index if not exists brain_usage_events_profile_created_idx
  on public.brain_usage_events (empresa_id, profile_id, created_at desc);

create table if not exists public.brain_feedback (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversation_id uuid not null,
  message_id text not null,
  profile_id uuid not null,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint brain_feedback_rating_check check (rating in (-1, 1)),
  constraint brain_feedback_conversation_empresa_fkey
    foreign key (conversation_id, empresa_id)
    references public.brain_conversations(id, empresa_id)
    on delete cascade,
  constraint brain_feedback_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint brain_feedback_unique unique (conversation_id, message_id, profile_id)
);

alter table public.brain_conversations enable row level security;
alter table public.brain_messages enable row level security;
alter table public.brain_run_steps enable row level security;
alter table public.brain_run_events enable row level security;
alter table public.brain_approvals enable row level security;
alter table public.brain_usage_events enable row level security;
alter table public.brain_feedback enable row level security;

grant select, insert, update on public.brain_conversations to authenticated;
grant select, insert, update on public.brain_messages to authenticated;
grant select, insert, update on public.brain_runs to authenticated;
grant select, insert, update on public.brain_run_steps to authenticated;
grant select, insert on public.brain_run_events to authenticated;
grant select, insert, update on public.brain_approvals to authenticated;
grant select, insert on public.brain_usage_events to authenticated;
grant select, insert, update on public.brain_feedback to authenticated;
grant usage, select on sequence public.brain_messages_sequence_seq to authenticated;
grant usage, select on sequence public.brain_run_events_id_seq to authenticated;
grant usage, select on sequence public.brain_usage_events_id_seq to authenticated;

drop policy if exists brain_conversations_owner_policy on public.brain_conversations;
create policy brain_conversations_owner_policy on public.brain_conversations
for all to authenticated
using (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()))
with check (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()));

drop policy if exists brain_messages_owner_policy on public.brain_messages;
create policy brain_messages_owner_policy on public.brain_messages
for all to authenticated
using (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()))
with check (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()));

drop policy if exists brain_runs_mutation_policy on public.brain_runs;
create policy brain_runs_mutation_policy on public.brain_runs
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    initiated_by = (select auth.uid())
    or (select public.current_user_has_permission('brain.insights.view'))
  )
)
with check (empresa_id = (select public.current_empresa_id()) and initiated_by = (select auth.uid()));

drop policy if exists brain_run_steps_owner_policy on public.brain_run_steps;
create policy brain_run_steps_owner_policy on public.brain_run_steps
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and exists (
    select 1 from public.brain_runs r
    where r.id = brain_run_steps.run_id and r.empresa_id = brain_run_steps.empresa_id
      and r.initiated_by = (select auth.uid())
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and exists (
    select 1 from public.brain_runs r
    where r.id = brain_run_steps.run_id and r.empresa_id = brain_run_steps.empresa_id
      and r.initiated_by = (select auth.uid())
  )
);

drop policy if exists brain_run_events_owner_policy on public.brain_run_events;
create policy brain_run_events_owner_policy on public.brain_run_events
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and exists (
    select 1 from public.brain_runs r
    where r.id = brain_run_events.run_id and r.empresa_id = brain_run_events.empresa_id
      and r.initiated_by = (select auth.uid())
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and exists (
    select 1 from public.brain_runs r
    where r.id = brain_run_events.run_id and r.empresa_id = brain_run_events.empresa_id
      and r.initiated_by = (select auth.uid())
  )
);

drop policy if exists brain_approvals_owner_policy on public.brain_approvals;
create policy brain_approvals_owner_policy on public.brain_approvals
for all to authenticated
using (empresa_id = (select public.current_empresa_id()) and requested_by = (select auth.uid()))
with check (empresa_id = (select public.current_empresa_id()) and requested_by = (select auth.uid()));

drop policy if exists brain_usage_events_owner_policy on public.brain_usage_events;
create policy brain_usage_events_owner_policy on public.brain_usage_events
for all to authenticated
using (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()))
with check (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()));

drop policy if exists brain_feedback_owner_policy on public.brain_feedback;
create policy brain_feedback_owner_policy on public.brain_feedback
for all to authenticated
using (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()))
with check (empresa_id = (select public.current_empresa_id()) and profile_id = (select auth.uid()));
