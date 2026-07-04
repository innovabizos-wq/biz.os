-- Business Brain advanced integration.
-- Adds memory, cross-module signals and approved action plans.

alter table public.brain_recommendations
  add column if not exists action_id text,
  add column if not exists approval_required boolean not null default true,
  add column if not exists expected_impact text,
  add column if not exists priority_score numeric(8, 2) not null default 0,
  add column if not exists source_modules text[] not null default '{}'::text[];

create index if not exists brain_recommendations_empresa_priority_idx
  on public.brain_recommendations (empresa_id, status, priority_score desc, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brain_recommendations_id_empresa_unique'
  ) then
    alter table public.brain_recommendations
      add constraint brain_recommendations_id_empresa_unique unique (id, empresa_id);
  end if;
end $$;

create table if not exists public.brain_memory (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  memory_type text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  source_modules text[] not null default '{}'::text[],
  confidence numeric(5, 2) not null default 1,
  status text not null default 'active',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_memory_type_check check (memory_type in ('business_context', 'preference', 'rule', 'customer_pattern', 'operational_pattern', 'system_note')),
  constraint brain_memory_status_check check (status in ('active', 'archived')),
  constraint brain_memory_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint brain_memory_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint brain_memory_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index if not exists brain_memory_empresa_status_idx
  on public.brain_memory (empresa_id, status, memory_type, updated_at desc);

drop trigger if exists set_brain_memory_updated_at on public.brain_memory;
create trigger set_brain_memory_updated_at
before update on public.brain_memory
for each row execute function public.set_updated_at();

create table if not exists public.brain_signals (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid,
  module_code text not null,
  signal_type text not null,
  severity text not null default 'medium',
  status text not null default 'active',
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  entity_type text,
  entity_id text,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_signals_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint brain_signals_status_check check (status in ('active', 'resolved', 'expired')),
  constraint brain_signals_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete set null (run_id)
);

create index if not exists brain_signals_empresa_status_idx
  on public.brain_signals (empresa_id, status, severity, detected_at desc);
create index if not exists brain_signals_empresa_module_idx
  on public.brain_signals (empresa_id, module_code, signal_type);

drop trigger if exists set_brain_signals_updated_at on public.brain_signals;
create trigger set_brain_signals_updated_at
before update on public.brain_signals
for each row execute function public.set_updated_at();

create table if not exists public.brain_action_plans (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  recommendation_id uuid,
  title text not null,
  description text not null,
  status text not null default 'pending_approval',
  risk_level text not null default 'medium',
  expected_impact text,
  source_modules text[] not null default '{}'::text[],
  approval_required boolean not null default true,
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_action_plans_id_empresa_unique unique (id, empresa_id),
  constraint brain_action_plans_status_check check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'failed', 'cancelled')),
  constraint brain_action_plans_risk_check check (risk_level in ('low', 'medium', 'high', 'critical')),
  constraint brain_action_plans_recommendation_empresa_fkey
    foreign key (recommendation_id, empresa_id)
    references public.brain_recommendations(id, empresa_id)
    on delete set null (recommendation_id),
  constraint brain_action_plans_approved_by_empresa_fkey
    foreign key (approved_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (approved_by),
  constraint brain_action_plans_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index if not exists brain_action_plans_empresa_status_idx
  on public.brain_action_plans (empresa_id, status, created_at desc);
create index if not exists brain_action_plans_empresa_recommendation_idx
  on public.brain_action_plans (empresa_id, recommendation_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brain_action_plans_id_empresa_unique'
  ) then
    alter table public.brain_action_plans
      add constraint brain_action_plans_id_empresa_unique unique (id, empresa_id);
  end if;
end $$;

drop trigger if exists set_brain_action_plans_updated_at on public.brain_action_plans;
create trigger set_brain_action_plans_updated_at
before update on public.brain_action_plans
for each row execute function public.set_updated_at();

create table if not exists public.brain_plan_steps (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  plan_id uuid not null,
  step_order integer not null default 1,
  action_id text not null,
  title text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  requires_confirmation boolean not null default true,
  result jsonb not null default '{}'::jsonb,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_plan_steps_status_check check (status in ('pending', 'approved', 'executing', 'completed', 'failed', 'skipped', 'confirmation_required')),
  constraint brain_plan_steps_plan_empresa_fkey
    foreign key (plan_id, empresa_id)
    references public.brain_action_plans(id, empresa_id)
    on delete cascade,
  constraint brain_plan_steps_order_unique unique (empresa_id, plan_id, step_order)
);

create index if not exists brain_plan_steps_empresa_plan_idx
  on public.brain_plan_steps (empresa_id, plan_id, step_order);

drop trigger if exists set_brain_plan_steps_updated_at on public.brain_plan_steps;
create trigger set_brain_plan_steps_updated_at
before update on public.brain_plan_steps
for each row execute function public.set_updated_at();

alter table public.brain_memory enable row level security;
alter table public.brain_signals enable row level security;
alter table public.brain_action_plans enable row level security;
alter table public.brain_plan_steps enable row level security;

grant select, insert, update on public.brain_memory to authenticated;
grant select, insert, update on public.brain_signals to authenticated;
grant select, insert, update on public.brain_action_plans to authenticated;
grant select, insert, update on public.brain_plan_steps to authenticated;
grant insert, update on public.brain_recommendations to authenticated;

drop policy if exists brain_memory_select_permission on public.brain_memory;
create policy brain_memory_select_permission
on public.brain_memory
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_memory_write_permission on public.brain_memory;
create policy brain_memory_write_permission
on public.brain_memory
for all
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_signals_select_permission on public.brain_signals;
create policy brain_signals_select_permission
on public.brain_signals
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_signals_write_permission on public.brain_signals;
create policy brain_signals_write_permission
on public.brain_signals
for all
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.settings.manage'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_action_plans_select_permission on public.brain_action_plans;
create policy brain_action_plans_select_permission
on public.brain_action_plans
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.recommendations.view'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_action_plans_write_permission on public.brain_action_plans;
create policy brain_action_plans_write_permission
on public.brain_action_plans
for all
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);

drop policy if exists brain_plan_steps_select_permission on public.brain_plan_steps;
create policy brain_plan_steps_select_permission
on public.brain_plan_steps
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.recommendations.view'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

drop policy if exists brain_plan_steps_write_permission on public.brain_plan_steps;
create policy brain_plan_steps_write_permission
on public.brain_plan_steps
for all
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);

drop policy if exists brain_recommendations_manage_permission on public.brain_recommendations;
create policy brain_recommendations_manage_permission
on public.brain_recommendations
for all
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.recommendations.manage'))
);

drop function if exists public.listar_brain_recommendations();
create function public.listar_brain_recommendations()
returns table (
  id uuid,
  insight_id uuid,
  recommendation_type text,
  risk_level text,
  status text,
  title text,
  description text,
  evidence jsonb,
  action_id text,
  approval_required boolean,
  expected_impact text,
  priority_score numeric,
  source_modules text[],
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.assert_brain_read_access();
begin
  if not (
    public.current_user_has_permission('brain.recommendations.view')
    or public.current_user_has_permission('brain.recommendations.manage')
  ) then
    raise exception 'Permiso brain.recommendations.view requerido.' using errcode = '42501';
  end if;

  return query
  select
    r.id,
    r.insight_id,
    r.recommendation_type,
    r.risk_level,
    r.status,
    r.title,
    r.description,
    r.evidence,
    r.action_id,
    r.approval_required,
    r.expected_impact,
    r.priority_score,
    r.source_modules,
    r.created_at,
    r.updated_at
  from public.brain_recommendations as r
  where r.empresa_id = v_empresa_id
    and r.status in ('pending', 'approved', 'scheduled', 'executing')
  order by
    r.priority_score desc,
    case r.risk_level
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      else 4
    end,
    r.created_at desc
  limit 50;
end;
$$;

revoke all on function public.listar_brain_recommendations() from public;
grant execute on function public.listar_brain_recommendations() to authenticated;
