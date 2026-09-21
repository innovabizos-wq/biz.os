-- Brain stages 5-7: equipos IA/humanos, conocimiento autorizado y autopilot gobernado.
-- Fuente canonica de esta migracion. La copia database/migrations/0075_* se genera
-- mediante scripts/sync-brain-migrations.mjs.

create extension if not exists vector with schema extensions;

alter table public.brain_runs add column if not exists parent_run_id uuid;
alter table public.brain_runs add column if not exists audience text not null default 'internal';
alter table public.brain_runs add column if not exists priority text not null default 'medium';
alter table public.brain_runs add column if not exists token_budget integer;
alter table public.brain_runs add column if not exists cost_budget_usd numeric(12, 6);
alter table public.brain_runs add column if not exists actual_cost_usd numeric(12, 6) not null default 0;
alter table public.brain_runs add column if not exists max_concurrency integer not null default 1;
alter table public.brain_runs add column if not exists deadline_at timestamptz;
alter table public.brain_runs add column if not exists cancel_requested_at timestamptz;
alter table public.brain_runs add column if not exists last_heartbeat_at timestamptz;
alter table public.brain_runs add column if not exists error_code text;
alter table public.brain_runs add column if not exists value_generated jsonb not null default '{}'::jsonb;

alter table public.brain_runs drop constraint if exists brain_runs_kind_check;
alter table public.brain_runs add constraint brain_runs_kind_check
  check (kind in (
    'analysis', 'conversation', 'tool', 'workflow', 'automation',
    'interaction', 'agent', 'team'
  ));
alter table public.brain_runs drop constraint if exists brain_runs_source_check;
alter table public.brain_runs add constraint brain_runs_source_check
  check (source in (
    'manual', 'scheduled', 'system', 'bar', 'brain', 'api', 'automation',
    'customer', 'event', 'webhook', 'job', 'module'
  ));
alter table public.brain_runs drop constraint if exists brain_runs_audience_check;
alter table public.brain_runs add constraint brain_runs_audience_check
  check (audience in ('internal', 'customer', 'agent', 'system'));
alter table public.brain_runs drop constraint if exists brain_runs_priority_check;
alter table public.brain_runs add constraint brain_runs_priority_check
  check (priority in ('low', 'medium', 'high', 'critical'));
alter table public.brain_runs drop constraint if exists brain_runs_max_concurrency_check;
alter table public.brain_runs add constraint brain_runs_max_concurrency_check
  check (max_concurrency between 1 and 8);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brain_runs_parent_empresa_fkey'
  ) then
    alter table public.brain_runs
      add constraint brain_runs_parent_empresa_fkey
      foreign key (parent_run_id, empresa_id)
      references public.brain_runs(id, empresa_id)
      on delete set null (parent_run_id);
  end if;
end $$;

create index if not exists brain_runs_parent_idx
  on public.brain_runs (empresa_id, parent_run_id, created_at desc);
create index if not exists brain_runs_health_idx
  on public.brain_runs (empresa_id, status, kind, created_at desc);

create table if not exists public.brain_team_runs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid not null,
  supervisor_profile_id uuid not null,
  objective text not null,
  status text not null default 'planning',
  max_concurrency integer not null default 3,
  max_depth integer not null default 1,
  token_budget integer not null default 30000,
  cost_budget_usd numeric(12, 6) not null default 3,
  deadline_at timestamptz,
  plan jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint brain_team_runs_status_check
    check (status in ('planning', 'running', 'waiting_human', 'verifying', 'completed', 'failed', 'cancelled')),
  constraint brain_team_runs_concurrency_check check (max_concurrency between 1 and 8),
  constraint brain_team_runs_depth_check check (max_depth between 1 and 3),
  constraint brain_team_runs_run_empresa_fkey
    foreign key (run_id, empresa_id) references public.brain_runs(id, empresa_id) on delete cascade,
  constraint brain_team_runs_supervisor_empresa_fkey
    foreign key (supervisor_profile_id, empresa_id)
    references public.profiles(id, empresa_id) on delete cascade,
  constraint brain_team_runs_id_empresa_unique unique (id, empresa_id),
  constraint brain_team_runs_run_unique unique (run_id)
);

drop trigger if exists set_brain_team_runs_updated_at on public.brain_team_runs;
create trigger set_brain_team_runs_updated_at
before update on public.brain_team_runs
for each row execute function public.set_updated_at();

create table if not exists public.brain_team_members (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  team_run_id uuid not null,
  agent_id text not null,
  role text not null,
  instructions text not null,
  allowed_skills text[] not null default '{}'::text[],
  success_criteria text[] not null default '{}'::text[],
  token_budget integer not null default 10000,
  cost_budget_usd numeric(12, 6) not null default 1,
  status text not null default 'pending',
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint brain_team_members_status_check
    check (status in ('pending', 'running', 'waiting_human', 'completed', 'failed', 'cancelled')),
  constraint brain_team_members_team_empresa_fkey
    foreign key (team_run_id, empresa_id)
    references public.brain_team_runs(id, empresa_id) on delete cascade,
  constraint brain_team_members_unique unique (team_run_id, agent_id, role)
);

create table if not exists public.brain_work_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid,
  team_run_id uuid,
  workflow_run_id text,
  hook_token text,
  created_by uuid not null,
  assigned_profile_id uuid not null,
  title text not null,
  description text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  sla_due_at timestamptz,
  comments jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  return_to_ai boolean not null default true,
  version integer not null default 1,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_work_items_status_check
    check (status in ('open', 'in_progress', 'blocked', 'needs_changes', 'completed', 'cancelled')),
  constraint brain_work_items_priority_check
    check (priority in ('low', 'medium', 'high', 'critical')),
  constraint brain_work_items_hook_token_unique unique (hook_token),
  constraint brain_work_items_run_empresa_fkey
    foreign key (run_id, empresa_id) references public.brain_runs(id, empresa_id) on delete cascade,
  constraint brain_work_items_team_empresa_fkey
    foreign key (team_run_id, empresa_id)
    references public.brain_team_runs(id, empresa_id) on delete cascade,
  constraint brain_work_items_creator_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id) on delete cascade,
  constraint brain_work_items_assignee_empresa_fkey
    foreign key (assigned_profile_id, empresa_id) references public.profiles(id, empresa_id) on delete cascade
);

drop trigger if exists set_brain_work_items_updated_at on public.brain_work_items;
create trigger set_brain_work_items_updated_at
before update on public.brain_work_items
for each row execute function public.set_updated_at();

create index if not exists brain_work_items_assignee_agenda_idx
  on public.brain_work_items (empresa_id, assigned_profile_id, status, sla_due_at);
create index if not exists brain_work_items_team_idx
  on public.brain_work_items (empresa_id, team_run_id, created_at);

create or replace function public.notify_brain_work_item_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.assigned_profile_id is distinct from old.assigned_profile_id then
    insert into public.user_notifications (
      empresa_id, recipient_profile_id, actor_profile_id, type, title, message,
      href, entity_type, entity_id, metadata
    ) values (
      new.empresa_id, new.assigned_profile_id, new.created_by, 'task',
      'Brain te asigno una tarea', new.title, '/brain?workItem=' || new.id::text,
      'brain_work_item', new.id,
      jsonb_build_object('priority', new.priority, 'slaDueAt', new.sla_due_at)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_brain_work_item_assignment on public.brain_work_items;
create trigger notify_brain_work_item_assignment
after insert or update of assigned_profile_id on public.brain_work_items
for each row execute function public.notify_brain_work_item_assignment();

create table if not exists public.brain_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  name text not null,
  source_type text not null,
  source_url text,
  audiences text[] not null default array['internal']::text[],
  status text not null default 'draft',
  provenance text not null,
  version integer not null default 1,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_knowledge_sources_type_check
    check (source_type in ('brand', 'faq', 'catalog', 'policy', 'document', 'structured', 'approved_answer')),
  constraint brain_knowledge_sources_status_check
    check (status in ('draft', 'published', 'archived', 'error')),
  constraint brain_knowledge_sources_audience_check
    check (audiences <@ array['internal', 'customer', 'agent', 'system']::text[]),
  constraint brain_knowledge_sources_creator_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id) on delete cascade,
  constraint brain_knowledge_sources_id_empresa_unique unique (id, empresa_id),
  constraint brain_knowledge_sources_name_unique unique (empresa_id, source_type, name)
);

drop trigger if exists set_brain_knowledge_sources_updated_at on public.brain_knowledge_sources;
create trigger set_brain_knowledge_sources_updated_at
before update on public.brain_knowledge_sources
for each row execute function public.set_updated_at();

create table if not exists public.brain_knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  source_id uuid not null,
  external_key text,
  title text not null,
  content text not null,
  mime_type text not null default 'text/plain',
  audiences text[] not null default array['internal']::text[],
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_knowledge_documents_source_empresa_fkey
    foreign key (source_id, empresa_id)
    references public.brain_knowledge_sources(id, empresa_id) on delete cascade,
  constraint brain_knowledge_documents_audience_check
    check (audiences <@ array['internal', 'customer', 'agent', 'system']::text[]),
  constraint brain_knowledge_documents_id_empresa_unique unique (id, empresa_id),
  constraint brain_knowledge_documents_version_unique unique (source_id, external_key, version)
);

drop trigger if exists set_brain_knowledge_documents_updated_at on public.brain_knowledge_documents;
create trigger set_brain_knowledge_documents_updated_at
before update on public.brain_knowledge_documents
for each row execute function public.set_updated_at();

create table if not exists public.brain_knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  source_id uuid not null,
  document_id uuid not null,
  chunk_index integer not null,
  content text not null,
  token_count integer not null default 0,
  audiences text[] not null default array['internal']::text[],
  embedding extensions.vector(768),
  search_vector tsvector generated always as (
    to_tsvector('spanish'::regconfig, coalesce(content, ''))
  ) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_knowledge_chunks_source_empresa_fkey
    foreign key (source_id, empresa_id)
    references public.brain_knowledge_sources(id, empresa_id) on delete cascade,
  constraint brain_knowledge_chunks_document_empresa_fkey
    foreign key (document_id, empresa_id)
    references public.brain_knowledge_documents(id, empresa_id) on delete cascade,
  constraint brain_knowledge_chunks_audience_check
    check (audiences <@ array['internal', 'customer', 'agent', 'system']::text[]),
  constraint brain_knowledge_chunks_document_index_unique unique (document_id, chunk_index)
);

drop trigger if exists set_brain_knowledge_chunks_updated_at on public.brain_knowledge_chunks;
create trigger set_brain_knowledge_chunks_updated_at
before update on public.brain_knowledge_chunks
for each row execute function public.set_updated_at();

create index if not exists brain_knowledge_chunks_search_idx
  on public.brain_knowledge_chunks using gin (search_vector);
create index if not exists brain_knowledge_chunks_embedding_idx
  on public.brain_knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists brain_knowledge_sources_published_idx
  on public.brain_knowledge_sources (empresa_id, status, published_at desc);

create or replace function public.buscar_conocimiento_brain(
  p_query text,
  p_audience text default 'internal',
  p_query_embedding extensions.vector(768) default null,
  p_limit integer default 8
)
returns table (
  chunk_id uuid,
  source_id uuid,
  source_name text,
  source_url text,
  document_id uuid,
  document_title text,
  content text,
  freshness_at timestamptz,
  score double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      c.id as chunk_id,
      s.id as source_id,
      s.name as source_name,
      s.source_url,
      d.id as document_id,
      d.title as document_title,
      c.content,
      greatest(c.updated_at, d.updated_at, s.updated_at) as freshness_at,
      (
        ts_rank_cd(c.search_vector, websearch_to_tsquery('spanish'::regconfig, p_query)) * 0.45
        + case
            when p_query_embedding is null or c.embedding is null then 0
            -- pgvector lives in the extensions schema while this function keeps an
            -- empty search_path. Qualify the cosine-distance operator explicitly.
            else (1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding)) * 0.55
          end
      )::double precision as score
    from public.brain_knowledge_chunks c
    join public.brain_knowledge_documents d
      on d.id = c.document_id and d.empresa_id = c.empresa_id
    join public.brain_knowledge_sources s
      on s.id = c.source_id and s.empresa_id = c.empresa_id
    where c.empresa_id = public.current_empresa_id()
      and p_audience = any(c.audiences)
      and p_audience = any(d.audiences)
      and p_audience = any(s.audiences)
      and s.status = 'published'
      and s.published_at is not null
      and (s.expires_at is null or s.expires_at > now())
      and d.effective_from <= now()
      and (d.effective_to is null or d.effective_to > now())
      and (
        c.search_vector @@ websearch_to_tsquery('spanish'::regconfig, p_query)
        or (p_query_embedding is not null and c.embedding is not null)
      )
  )
  select * from ranked
  where ranked.score > 0
  order by ranked.score desc, ranked.freshness_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

create table if not exists public.brain_customer_sessions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  channel text not null,
  external_conversation_id text not null,
  customer_id uuid,
  verification_status text not null default 'unverified',
  verified_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_customer_sessions_channel_check check (channel in ('inbox', 'whapp', 'api')),
  constraint brain_customer_sessions_verification_check
    check (verification_status in ('unverified', 'pending', 'verified', 'expired', 'blocked')),
  constraint brain_customer_sessions_unique unique (empresa_id, channel, external_conversation_id)
);

drop trigger if exists set_brain_customer_sessions_updated_at on public.brain_customer_sessions;
create trigger set_brain_customer_sessions_updated_at
before update on public.brain_customer_sessions
for each row execute function public.set_updated_at();

create table if not exists public.brain_autonomy_rules (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  capability_id text not null,
  mode text not null default 'suggest',
  shadow_mode boolean not null default false,
  rollout_percentage integer not null default 100,
  enabled boolean not null default true,
  daily_limit integer not null default 10,
  amount_limit numeric(14, 2),
  allowed_channels text[] not null default '{}'::text[],
  window_start time,
  window_end time,
  timezone text not null default 'America/Costa_Rica',
  responsible_profile_id uuid,
  success_criteria jsonb not null default '{}'::jsonb,
  failure_threshold integer not null default 3,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brain_autonomy_rules_mode_check check (mode in ('suggest', 'approve', 'auto')),
  constraint brain_autonomy_rules_rollout_check check (rollout_percentage between 0 and 100),
  constraint brain_autonomy_rules_failure_threshold_check check (failure_threshold between 1 and 20),
  constraint brain_autonomy_rules_creator_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id) on delete cascade,
  constraint brain_autonomy_rules_responsible_empresa_fkey
    foreign key (responsible_profile_id, empresa_id)
    references public.profiles(id, empresa_id) on delete set null,
  constraint brain_autonomy_rules_id_empresa_unique unique (id, empresa_id)
);

drop trigger if exists set_brain_autonomy_rules_updated_at on public.brain_autonomy_rules;
create trigger set_brain_autonomy_rules_updated_at
before update on public.brain_autonomy_rules
for each row execute function public.set_updated_at();

create table if not exists public.brain_runtime_triggers (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rule_id uuid,
  event_type text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received',
  run_id uuid,
  error jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint brain_runtime_triggers_status_check
    check (status in ('received', 'ignored', 'queued', 'running', 'completed', 'failed', 'blocked')),
  constraint brain_runtime_triggers_rule_empresa_fkey
    foreign key (rule_id, empresa_id)
    references public.brain_autonomy_rules(id, empresa_id) on delete set null,
  constraint brain_runtime_triggers_run_empresa_fkey
    foreign key (run_id, empresa_id) references public.brain_runs(id, empresa_id) on delete set null,
  constraint brain_runtime_triggers_id_empresa_unique unique (id, empresa_id),
  constraint brain_runtime_triggers_dedupe_unique unique (empresa_id, dedupe_key)
);

create index if not exists brain_runtime_triggers_queue_idx
  on public.brain_runtime_triggers (status, received_at);

create table if not exists public.brain_trigger_executions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  trigger_id uuid not null,
  rule_id uuid not null,
  status text not null default 'queued',
  result jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint brain_trigger_executions_status_check
    check (status in ('queued', 'waiting_approval', 'running', 'completed', 'failed', 'blocked')),
  constraint brain_trigger_executions_trigger_empresa_fkey
    foreign key (trigger_id, empresa_id)
    references public.brain_runtime_triggers(id, empresa_id) on delete cascade,
  constraint brain_trigger_executions_rule_empresa_fkey
    foreign key (rule_id, empresa_id)
    references public.brain_autonomy_rules(id, empresa_id) on delete cascade,
  constraint brain_trigger_executions_unique unique (trigger_id, rule_id)
);

create index if not exists brain_trigger_executions_rule_daily_idx
  on public.brain_trigger_executions (empresa_id, rule_id, created_at desc);

create table if not exists public.brain_skill_health (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  skill_id text not null,
  status text not null default 'enabled',
  consecutive_errors integer not null default 0,
  error_threshold integer not null default 3,
  paused_until timestamptz,
  last_error jsonb,
  last_success_at timestamptz,
  last_error_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint brain_skill_health_status_check check (status in ('enabled', 'paused', 'disabled')),
  constraint brain_skill_health_unique unique (empresa_id, skill_id)
);

create table if not exists public.brain_value_events (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid,
  metric text not null,
  value numeric(16, 4) not null default 1,
  unit text not null default 'task',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint brain_value_events_run_empresa_fkey
    foreign key (run_id, empresa_id) references public.brain_runs(id, empresa_id) on delete set null
);

create table if not exists public.brain_eval_runs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  suite text not null,
  status text not null default 'running',
  total_cases integer not null default 0,
  passed_cases integer not null default 0,
  failed_cases integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  commit_sha text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint brain_eval_runs_status_check check (status in ('running', 'passed', 'failed', 'cancelled'))
);

alter table public.brain_team_runs enable row level security;
alter table public.brain_team_members enable row level security;
alter table public.brain_work_items enable row level security;
alter table public.brain_knowledge_sources enable row level security;
alter table public.brain_knowledge_documents enable row level security;
alter table public.brain_knowledge_chunks enable row level security;
alter table public.brain_customer_sessions enable row level security;
alter table public.brain_autonomy_rules enable row level security;
alter table public.brain_runtime_triggers enable row level security;
alter table public.brain_trigger_executions enable row level security;
alter table public.brain_skill_health enable row level security;
alter table public.brain_value_events enable row level security;
alter table public.brain_eval_runs enable row level security;

grant select, insert, update on public.brain_team_runs to authenticated;
grant select, insert, update on public.brain_team_members to authenticated;
grant select, insert, update on public.brain_work_items to authenticated;
grant select, insert, update, delete on public.brain_knowledge_sources to authenticated;
grant select, insert, update, delete on public.brain_knowledge_documents to authenticated;
grant select, insert, update, delete on public.brain_knowledge_chunks to authenticated;
grant select, insert, update on public.brain_customer_sessions to authenticated;
grant select, insert, update, delete on public.brain_autonomy_rules to authenticated;
grant select, insert, update on public.brain_runtime_triggers to authenticated;
grant select, insert, update on public.brain_trigger_executions to authenticated;
grant select, insert, update on public.brain_skill_health to authenticated;
grant select, insert on public.brain_value_events to authenticated;
grant select, insert, update on public.brain_eval_runs to authenticated;
grant usage, select on sequence public.brain_value_events_id_seq to authenticated;
grant execute on function public.buscar_conocimiento_brain(text, text, extensions.vector, integer) to authenticated;

drop policy if exists brain_team_runs_tenant_policy on public.brain_team_runs;
create policy brain_team_runs_tenant_policy on public.brain_team_runs
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    supervisor_profile_id = (select auth.uid())
    or (select public.current_user_has_permission('brain.insights.view'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and supervisor_profile_id = (select auth.uid())
);

drop policy if exists brain_team_members_tenant_policy on public.brain_team_members;
create policy brain_team_members_tenant_policy on public.brain_team_members
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and exists (
    select 1 from public.brain_team_runs tr
    where tr.id = brain_team_members.team_run_id
      and tr.empresa_id = brain_team_members.empresa_id
      and tr.supervisor_profile_id = (select auth.uid())
  )
);

drop policy if exists brain_work_items_tenant_policy on public.brain_work_items;
create policy brain_work_items_tenant_policy on public.brain_work_items
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    assigned_profile_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select public.current_user_has_permission('brain.insights.view'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    created_by = (select auth.uid())
    or assigned_profile_id = (select auth.uid())
  )
);

drop policy if exists brain_knowledge_sources_tenant_policy on public.brain_knowledge_sources;
drop policy if exists brain_knowledge_sources_select_policy on public.brain_knowledge_sources;
create policy brain_knowledge_sources_select_policy on public.brain_knowledge_sources
for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);
drop policy if exists brain_knowledge_sources_write_policy on public.brain_knowledge_sources;
create policy brain_knowledge_sources_write_policy on public.brain_knowledge_sources
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and created_by = (select auth.uid())
  and (select public.current_user_has_permission('brain.settings.manage'))
);

drop policy if exists brain_knowledge_documents_tenant_policy on public.brain_knowledge_documents;
drop policy if exists brain_knowledge_documents_select_policy on public.brain_knowledge_documents;
create policy brain_knowledge_documents_select_policy on public.brain_knowledge_documents
for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);
drop policy if exists brain_knowledge_documents_write_policy on public.brain_knowledge_documents;
create policy brain_knowledge_documents_write_policy on public.brain_knowledge_documents
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
);

drop policy if exists brain_knowledge_chunks_tenant_policy on public.brain_knowledge_chunks;
drop policy if exists brain_knowledge_chunks_select_policy on public.brain_knowledge_chunks;
create policy brain_knowledge_chunks_select_policy on public.brain_knowledge_chunks
for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);
drop policy if exists brain_knowledge_chunks_write_policy on public.brain_knowledge_chunks;
create policy brain_knowledge_chunks_write_policy on public.brain_knowledge_chunks
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
);

drop policy if exists brain_customer_sessions_tenant_policy on public.brain_customer_sessions;
drop policy if exists brain_customer_sessions_select_policy on public.brain_customer_sessions;
create policy brain_customer_sessions_select_policy on public.brain_customer_sessions
for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('inbox.conversations.view'))
);
drop policy if exists brain_customer_sessions_write_policy on public.brain_customer_sessions;
create policy brain_customer_sessions_write_policy on public.brain_customer_sessions
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('inbox.conversations.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('inbox.conversations.view'))
);

drop policy if exists brain_autonomy_rules_tenant_policy on public.brain_autonomy_rules;
create policy brain_autonomy_rules_tenant_policy on public.brain_autonomy_rules
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and created_by = (select auth.uid())
  and (select public.current_user_has_permission('brain.settings.manage'))
);

drop policy if exists brain_runtime_triggers_tenant_policy on public.brain_runtime_triggers;
create policy brain_runtime_triggers_tenant_policy on public.brain_runtime_triggers
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_skill_health_tenant_policy on public.brain_skill_health;
create policy brain_skill_health_tenant_policy on public.brain_skill_health
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_trigger_executions_tenant_policy on public.brain_trigger_executions;
create policy brain_trigger_executions_tenant_policy on public.brain_trigger_executions
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_value_events_tenant_policy on public.brain_value_events;
create policy brain_value_events_tenant_policy on public.brain_value_events
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_eval_runs_tenant_policy on public.brain_eval_runs;
drop policy if exists brain_eval_runs_select_policy on public.brain_eval_runs;
create policy brain_eval_runs_select_policy on public.brain_eval_runs
for select to authenticated
using (
  empresa_id is null
  or (
    empresa_id = (select public.current_empresa_id())
    and (select public.current_user_has_permission('brain.insights.view'))
  )
);
drop policy if exists brain_eval_runs_write_policy on public.brain_eval_runs;
create policy brain_eval_runs_write_policy on public.brain_eval_runs
for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.settings.manage'))
);
