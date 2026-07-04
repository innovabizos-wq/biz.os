-- Business Brain base module.
-- Deterministic metrics and recommendations only. No AI models, Agent Executor or Autopilot.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values (
  'brain',
  'Business Brain',
  'Inteligencia transversal para metricas, insights y recomendaciones operativas.',
  'activo',
  160
)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  estado = excluded.estado,
  orden = excluded.orden;

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('brain.insights.view', 'Ver insights del Brain', 'Permite consultar metricas e insights del Business Brain.', 'brain', 'activo'),
  ('brain.recommendations.view', 'Ver recomendaciones del Brain', 'Permite consultar recomendaciones generadas por Business Brain.', 'brain', 'activo'),
  ('brain.recommendations.manage', 'Gestionar recomendaciones del Brain', 'Permite aprobar, rechazar o preparar recomendaciones del Business Brain.', 'brain', 'activo'),
  ('brain.settings.manage', 'Administrar Business Brain', 'Permite ejecutar analisis deterministico y administrar configuracion del Brain.', 'brain', 'activo')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

create table if not exists public.brain_runs (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  status text not null default 'running',
  source text not null default 'manual',
  metrics_date date not null default current_date,
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint brain_runs_status_check check (status in ('running', 'completed', 'failed')),
  constraint brain_runs_source_check check (source in ('manual', 'scheduled', 'system')),
  constraint brain_runs_id_empresa_unique unique (id, empresa_id),
  constraint brain_runs_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index if not exists brain_runs_empresa_created_idx
  on public.brain_runs (empresa_id, created_at desc);
create index if not exists brain_runs_empresa_status_idx
  on public.brain_runs (empresa_id, status);

create table if not exists public.brain_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid,
  metric_date date not null default current_date,
  crm_customers_count integer not null default 0,
  crm_prospects_count integer not null default 0,
  followups_pending_count integer not null default 0,
  followups_overdue_count integer not null default 0,
  quotes_open_count integer not null default 0,
  quotes_expired_count integer not null default 0,
  sales_30d_count integer not null default 0,
  sales_30d_total numeric(14, 2) not null default 0,
  inventory_low_stock_count integer not null default 0,
  payments_overdue_count integer not null default 0,
  whapp_open_conversations_count integer not null default 0,
  business_context_ready boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_daily_metrics_empresa_date_unique unique (empresa_id, metric_date),
  constraint brain_daily_metrics_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete set null (run_id)
);

create index if not exists brain_daily_metrics_empresa_date_idx
  on public.brain_daily_metrics (empresa_id, metric_date desc);

drop trigger if exists set_brain_daily_metrics_updated_at on public.brain_daily_metrics;
create trigger set_brain_daily_metrics_updated_at
before update on public.brain_daily_metrics
for each row execute function public.set_updated_at();

create table if not exists public.brain_insights (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  run_id uuid,
  insight_type text not null,
  severity text not null default 'medium',
  status text not null default 'active',
  title text not null,
  description text not null,
  source text not null default 'deterministic',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint brain_insights_type_check check (insight_type in ('opportunity', 'risk', 'anomaly', 'performance', 'process', 'data_quality', 'customer_signal')),
  constraint brain_insights_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint brain_insights_status_check check (status in ('active', 'dismissed', 'resolved', 'expired')),
  constraint brain_insights_id_empresa_unique unique (id, empresa_id),
  constraint brain_insights_run_empresa_fkey
    foreign key (run_id, empresa_id)
    references public.brain_runs(id, empresa_id)
    on delete set null (run_id)
);

create index if not exists brain_insights_empresa_status_idx
  on public.brain_insights (empresa_id, status, created_at desc);
create index if not exists brain_insights_empresa_type_idx
  on public.brain_insights (empresa_id, insight_type);

create table if not exists public.brain_recommendations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  insight_id uuid,
  recommendation_type text not null,
  risk_level text not null default 'medium',
  status text not null default 'pending',
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint brain_recommendations_type_check check (recommendation_type in ('commercial', 'operational', 'inventory', 'collections', 'service', 'management', 'data_quality')),
  constraint brain_recommendations_risk_check check (risk_level in ('low', 'medium', 'high', 'critical')),
  constraint brain_recommendations_status_check check (status in ('pending', 'approved', 'rejected', 'scheduled', 'executing', 'completed', 'failed', 'cancelled', 'expired')),
  constraint brain_recommendations_insight_empresa_fkey
    foreign key (insight_id, empresa_id)
    references public.brain_insights(id, empresa_id)
    on delete set null (insight_id),
  constraint brain_recommendations_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint brain_recommendations_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index if not exists brain_recommendations_empresa_status_idx
  on public.brain_recommendations (empresa_id, status, created_at desc);
create index if not exists brain_recommendations_empresa_insight_idx
  on public.brain_recommendations (empresa_id, insight_id);

drop trigger if exists set_brain_recommendations_updated_at on public.brain_recommendations;
create trigger set_brain_recommendations_updated_at
before update on public.brain_recommendations
for each row execute function public.set_updated_at();

alter table public.brain_runs enable row level security;
alter table public.brain_daily_metrics enable row level security;
alter table public.brain_insights enable row level security;
alter table public.brain_recommendations enable row level security;

grant select on public.brain_runs to authenticated;
grant select on public.brain_daily_metrics to authenticated;
grant select on public.brain_insights to authenticated;
grant select on public.brain_recommendations to authenticated;

drop policy if exists brain_runs_select_permission on public.brain_runs;
create policy brain_runs_select_permission
on public.brain_runs
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_daily_metrics_select_permission on public.brain_daily_metrics;
create policy brain_daily_metrics_select_permission
on public.brain_daily_metrics
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_insights_select_permission on public.brain_insights;
create policy brain_insights_select_permission
on public.brain_insights
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('brain.insights.view'))
);

drop policy if exists brain_recommendations_select_permission on public.brain_recommendations;
create policy brain_recommendations_select_permission
on public.brain_recommendations
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('brain.recommendations.view'))
    or (select public.current_user_has_permission('brain.recommendations.manage'))
  )
);

create or replace function public.current_company_has_active_module(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.empresa_modulos as em
    join public.modulos as m
      on m.id = em.modulo_id
    where em.empresa_id = public.current_empresa_id()
      and em.estado = 'activo'
      and m.codigo = p_codigo
      and m.estado = 'activo'
  );
$$;

create or replace function public.assert_brain_read_access()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_company_has_active_module('brain') then
    raise exception 'El modulo Business Brain no esta activo.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('brain.insights.view') then
    raise exception 'Permiso brain.insights.view requerido.' using errcode = '42501';
  end if;

  return v_empresa_id;
end;
$$;

create or replace function public.assert_brain_manage_access()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.assert_brain_read_access();
begin
  if not (
    public.current_user_has_permission('brain.settings.manage')
    or public.current_user_has_permission('brain.recommendations.manage')
  ) then
    raise exception 'Permiso de gestion de Business Brain requerido.' using errcode = '42501';
  end if;

  return v_empresa_id;
end;
$$;

create or replace function public.generar_brain_daily_metrics()
returns table (run_id uuid, metric_id uuid, metric_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.assert_brain_manage_access();
  v_user_id uuid := auth.uid();
  v_run_id uuid;
  v_metric_id uuid;
  v_metric_date date := current_date;
begin
  insert into public.brain_runs (empresa_id, status, source, metrics_date, created_by)
  values (v_empresa_id, 'running', 'manual', v_metric_date, v_user_id)
  returning id into v_run_id;

  insert into public.brain_daily_metrics (
    empresa_id,
    run_id,
    metric_date,
    crm_customers_count,
    crm_prospects_count,
    followups_pending_count,
    followups_overdue_count,
    quotes_open_count,
    quotes_expired_count,
    sales_30d_count,
    sales_30d_total,
    inventory_low_stock_count,
    payments_overdue_count,
    whapp_open_conversations_count,
    business_context_ready,
    metadata
  )
  select
    v_empresa_id,
    v_run_id,
    v_metric_date,
    (select count(*)::integer from public.crm_clientes where empresa_id = v_empresa_id and tipo = 'cliente'),
    (select count(*)::integer from public.crm_clientes where empresa_id = v_empresa_id and tipo = 'prospecto'),
    (select count(*)::integer from public.crm_seguimientos where empresa_id = v_empresa_id and estado = 'pendiente'),
    (select count(*)::integer from public.crm_seguimientos where empresa_id = v_empresa_id and estado = 'pendiente' and fecha_programada < now()),
    (select count(*)::integer from public.cotizaciones where empresa_id = v_empresa_id and estado in ('borrador', 'enviada')),
    (select count(*)::integer from public.cotizaciones where empresa_id = v_empresa_id and estado in ('borrador', 'enviada', 'vencida') and fecha_vencimiento is not null and fecha_vencimiento < current_date),
    (select count(*)::integer from public.ventas where empresa_id = v_empresa_id and fecha_venta >= current_date - interval '30 days' and estado <> 'cancelada'),
    (select coalesce(sum(total), 0) from public.ventas where empresa_id = v_empresa_id and fecha_venta >= current_date - interval '30 days' and estado <> 'cancelada'),
    (select count(*)::integer from public.inventario_stock where empresa_id = v_empresa_id and stock_minimo > 0 and cantidad <= stock_minimo),
    (select count(*)::integer from public.payments_accounts where empresa_id = v_empresa_id and tipo = 'receivable' and saldo > 0 and estado <> 'anulada' and (estado = 'vencida' or (fecha_vencimiento is not null and fecha_vencimiento < current_date))),
    (select count(*)::integer from public.inbox_conversaciones where empresa_id = v_empresa_id and canal = 'whatsapp' and estado in ('abierta', 'pendiente')),
    exists (select 1 from public.business_context where empresa_id = v_empresa_id),
    jsonb_build_object(
      'generatedBy', 'generar_brain_daily_metrics',
      'mode', 'deterministic',
      'aiUsed', false
    )
  on conflict on constraint brain_daily_metrics_empresa_date_unique
  do update set
    run_id = excluded.run_id,
    crm_customers_count = excluded.crm_customers_count,
    crm_prospects_count = excluded.crm_prospects_count,
    followups_pending_count = excluded.followups_pending_count,
    followups_overdue_count = excluded.followups_overdue_count,
    quotes_open_count = excluded.quotes_open_count,
    quotes_expired_count = excluded.quotes_expired_count,
    sales_30d_count = excluded.sales_30d_count,
    sales_30d_total = excluded.sales_30d_total,
    inventory_low_stock_count = excluded.inventory_low_stock_count,
    payments_overdue_count = excluded.payments_overdue_count,
    whapp_open_conversations_count = excluded.whapp_open_conversations_count,
    business_context_ready = excluded.business_context_ready,
    metadata = excluded.metadata,
    updated_at = now()
  returning id into v_metric_id;

  update public.brain_runs
  set
    status = 'completed',
    completed_at = now(),
    summary = (
      select to_jsonb(m)
      from public.brain_daily_metrics as m
      where m.id = v_metric_id
    )
  where id = v_run_id;

  return query select v_run_id, v_metric_id, v_metric_date;
exception
  when others then
    if v_run_id is not null then
      update public.brain_runs
      set status = 'failed', completed_at = now(), error_message = sqlerrm
      where id = v_run_id;
    end if;
    raise;
end;
$$;

create or replace function public.generar_brain_insights_basicos()
returns table (run_id uuid, insights_created integer, recommendations_created integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.assert_brain_manage_access();
  v_run_id uuid;
  v_metric_id uuid;
  v_metric public.brain_daily_metrics%rowtype;
  v_insights_created integer := 0;
  v_recommendations_created integer := 0;
  v_insight_id uuid;
begin
  select metrics.run_id, metrics.metric_id
  into v_run_id, v_metric_id
  from public.generar_brain_daily_metrics() as metrics
  limit 1;

  select * into v_metric
  from public.brain_daily_metrics
  where id = v_metric_id
    and empresa_id = v_empresa_id;

  if v_metric.followups_overdue_count > 0 then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'risk',
      'high',
      'Seguimientos vencidos',
      'Existen seguimientos pendientes con fecha vencida.',
      'agenda',
      jsonb_build_object('followupsOverdueCount', v_metric.followups_overdue_count)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Seguimientos vencidos'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'operational',
        'medium',
        'Priorizar seguimientos vencidos',
        'Revisar la agenda y contactar primero los clientes con compromisos vencidos.',
        jsonb_build_object('followupsOverdueCount', v_metric.followups_overdue_count)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  v_insight_id := null;
  if v_metric.quotes_expired_count > 0 then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'opportunity',
      'medium',
      'Cotizaciones vencidas o por recuperar',
      'Hay cotizaciones abiertas con fecha de vencimiento superada.',
      'quotes',
      jsonb_build_object('quotesExpiredCount', v_metric.quotes_expired_count)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Cotizaciones vencidas o por recuperar'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'commercial',
        'medium',
        'Reactivar cotizaciones vencidas',
        'Revisar las cotizaciones vencidas y definir si se contacta al cliente, se actualiza la oferta o se descarta.',
        jsonb_build_object('quotesExpiredCount', v_metric.quotes_expired_count)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  v_insight_id := null;
  if v_metric.inventory_low_stock_count > 0 then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'risk',
      'high',
      'Productos con inventario bajo',
      'Existen productos con stock igual o menor al minimo configurado.',
      'inventory',
      jsonb_build_object('inventoryLowStockCount', v_metric.inventory_low_stock_count)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Productos con inventario bajo'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'inventory',
        'high',
        'Revisar reposicion de inventario',
        'Validar productos bajo minimo antes de confirmar nuevas ventas o promesas de entrega.',
        jsonb_build_object('inventoryLowStockCount', v_metric.inventory_low_stock_count)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  v_insight_id := null;
  if v_metric.payments_overdue_count > 0 then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'risk',
      'high',
      'Cuentas por cobrar vencidas',
      'Hay cuentas por cobrar con saldo pendiente y vencimiento superado.',
      'payments',
      jsonb_build_object('paymentsOverdueCount', v_metric.payments_overdue_count)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Cuentas por cobrar vencidas'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'collections',
        'medium',
        'Priorizar cobranza vencida',
        'Revisar cuentas vencidas y preparar recordatorios manuales antes de escalar.',
        jsonb_build_object('paymentsOverdueCount', v_metric.payments_overdue_count)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  v_insight_id := null;
  if v_metric.whapp_open_conversations_count > 0 then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'customer_signal',
      'medium',
      'Conversaciones WhatsApp abiertas',
      'Existen conversaciones WhatsApp abiertas o pendientes.',
      'whapp',
      jsonb_build_object('whappOpenConversationsCount', v_metric.whapp_open_conversations_count)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Conversaciones WhatsApp abiertas'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'service',
        'medium',
        'Atender conversaciones pendientes',
        'Revisar Inbox/Whapp y priorizar conversaciones abiertas antes de crear automatizaciones.',
        jsonb_build_object('whappOpenConversationsCount', v_metric.whapp_open_conversations_count)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  v_insight_id := null;
  if not v_metric.business_context_ready then
    insert into public.brain_insights (empresa_id, run_id, insight_type, severity, title, description, source, evidence)
    select
      v_empresa_id,
      v_run_id,
      'data_quality',
      'medium',
      'Contexto del negocio pendiente',
      'Business Brain necesita business_context para interpretar datos operativos con criterio de empresa.',
      'business_context',
      jsonb_build_object('businessContextReady', false)
    where not exists (
      select 1 from public.brain_insights
      where empresa_id = v_empresa_id and status = 'active' and title = 'Contexto del negocio pendiente'
    )
    returning id into v_insight_id;

    if v_insight_id is not null then
      v_insights_created := v_insights_created + 1;
      insert into public.brain_recommendations (empresa_id, insight_id, recommendation_type, risk_level, title, description, evidence)
      values (
        v_empresa_id,
        v_insight_id,
        'management',
        'low',
        'Completar contexto del negocio',
        'Completar /admin/contexto antes de depender de recomendaciones avanzadas.',
        jsonb_build_object('businessContextReady', false)
      );
      v_recommendations_created := v_recommendations_created + 1;
    end if;
  end if;

  return query select v_run_id, v_insights_created, v_recommendations_created;
end;
$$;

create or replace function public.listar_brain_insights()
returns table (
  id uuid,
  run_id uuid,
  insight_type text,
  severity text,
  status text,
  title text,
  description text,
  source text,
  evidence jsonb,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.assert_brain_read_access();
begin
  return query
  select
    i.id,
    i.run_id,
    i.insight_type,
    i.severity,
    i.status,
    i.title,
    i.description,
    i.source,
    i.evidence,
    i.created_at,
    i.resolved_at
  from public.brain_insights as i
  where i.empresa_id = v_empresa_id
    and i.status = 'active'
  order by
    case i.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      else 4
    end,
    i.created_at desc
  limit 50;
end;
$$;

create or replace function public.listar_brain_recommendations()
returns table (
  id uuid,
  insight_id uuid,
  recommendation_type text,
  risk_level text,
  status text,
  title text,
  description text,
  evidence jsonb,
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
    r.created_at,
    r.updated_at
  from public.brain_recommendations as r
  where r.empresa_id = v_empresa_id
    and r.status = 'pending'
  order by
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

create or replace function public.recalcular_salud_modulos_empresa(p_empresa_id uuid)
returns table (
  modulo_codigo text,
  status text,
  configuration_complete boolean,
  credentials_present boolean,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.empresa_modulo_health (
    empresa_id,
    modulo_codigo,
    status,
    configuration_complete,
    credentials_present,
    last_success_at,
    last_error_at,
    last_error,
    metadata
  )
  select
    calculated.empresa_id,
    calculated.modulo_codigo,
    calculated.status,
    calculated.configuration_complete,
    calculated.credentials_present,
    case when calculated.status = 'healthy' then now() else h.last_success_at end,
    case when calculated.status in ('misconfigured', 'unhealthy') then now() else h.last_error_at end,
    calculated.last_error,
    calculated.metadata
  from (
    select
      base.*,
      case
        when base.company_status <> 'activo' then 'inactive'
        when base.configuration_complete and base.credentials_present then 'healthy'
        else 'misconfigured'
      end as status,
      case
        when base.company_status <> 'activo' then null
        when not base.configuration_complete then 'Configuracion incompleta.'
        when not base.credentials_present then 'Credenciales incompletas.'
        else null
      end as last_error
    from (
      select
        e.id as empresa_id,
        m.codigo as modulo_codigo,
        coalesce(em.estado, 'inactivo') as company_status,
        case m.codigo
          when 'admin' then exists (select 1 from public.profiles p where p.empresa_id = e.id and p.estado = 'activo')
          when 'inventory' then exists (select 1 from public.inventario_bodegas b where b.empresa_id = e.id)
          when 'hr' then exists (select 1 from public.rrhh_planilla_estados r where r.empresa_id = e.id)
          when 'billing' then exists (
            select 1 from public.configuraciones_empresa ce
            where ce.empresa_id = e.id and ce.clave = 'fiscal'
              and nullif(ce.valor->>'razonSocial', '') is not null
              and nullif(ce.valor->>'identificacion', '') is not null
              and nullif(ce.valor->>'actividadEconomica', '') is not null
              and nullif(ce.valor->>'correoEmisor', '') is not null
          )
          when 'whapp' then exists (
            select 1 from public.inbox_canales c
            where c.empresa_id = e.id and c.proveedor = 'meta' and c.canal = 'whatsapp'
              and c.estado = 'activo' and c.conexion_estado = 'configurado'
              and nullif(c.configuracion_publica->>'phone_number_id', '') is not null
          )
          when 'autoblog' then exists (select 1 from public.business_context bc where bc.empresa_id = e.id)
          when 'brain' then exists (select 1 from public.business_context bc where bc.empresa_id = e.id)
          when 'ai' then false
          when 'purchases' then false
          when 'payments' then false
          when 'mobile' then false
          else true
        end as configuration_complete,
        case m.codigo
          when 'billing' then exists (
            select 1 from public.configuraciones_empresa ce
            where ce.empresa_id = e.id and ce.clave = 'fiscal'
              and nullif(ce.valor->>'haciendaUsuarioEnc', '') is not null
              and nullif(ce.valor->>'haciendaPasswordEnc', '') is not null
              and nullif(ce.valor->>'p12Base64Enc', '') is not null
              and nullif(ce.valor->>'pinEnc', '') is not null
          )
          when 'whapp' then exists (
            select 1
            from public.inbox_canales c
            join public.inbox_canal_secretos s
              on s.empresa_id = c.empresa_id and s.canal_id = c.id
            where c.empresa_id = e.id and c.proveedor = 'meta' and c.canal = 'whatsapp'
              and c.estado = 'activo'
              and (s.access_token_secret_id is not null or nullif(s.access_token, '') is not null)
              and (s.app_secret_secret_id is not null or nullif(s.app_secret, '') is not null)
              and (s.verify_token_secret_id is not null or nullif(s.verify_token, '') is not null)
          )
          else true
        end as credentials_present,
        jsonb_build_object(
          'calculated_from', '0051_business_brain_base',
          'company_status', coalesce(em.estado, 'inactivo'),
          'business_context_present', exists (
            select 1 from public.business_context bc where bc.empresa_id = e.id
          ),
          'meta_secret_storage', coalesce((
            select jsonb_agg(distinct s.secret_storage)
            from public.inbox_canal_secretos s
            where s.empresa_id = e.id
          ), '[]'::jsonb)
        ) as metadata
      from public.empresas e
      cross join public.modulos m
      left join public.empresa_modulos em on em.empresa_id = e.id and em.modulo_id = m.id
      where e.id = p_empresa_id and m.estado = 'activo'
    ) as base
  ) as calculated
  left join public.empresa_modulo_health h
    on h.empresa_id = calculated.empresa_id and h.modulo_codigo = calculated.modulo_codigo
  on conflict on constraint empresa_modulo_health_unique
  do update set
    status = excluded.status,
    configuration_complete = excluded.configuration_complete,
    credentials_present = excluded.credentials_present,
    last_success_at = excluded.last_success_at,
    last_error_at = excluded.last_error_at,
    last_error = excluded.last_error,
    metadata = excluded.metadata,
    updated_at = now();

  return query
  select h.modulo_codigo, h.status, h.configuration_complete, h.credentials_present,
         h.last_success_at, h.last_error_at, h.last_error, h.metadata
  from public.empresa_modulo_health h
  where h.empresa_id = p_empresa_id
  order by h.modulo_codigo;
end;
$$;

revoke all on function public.current_company_has_active_module(text) from public;
revoke all on function public.assert_brain_read_access() from public;
revoke all on function public.assert_brain_manage_access() from public;
revoke all on function public.generar_brain_daily_metrics() from public;
revoke all on function public.generar_brain_insights_basicos() from public;
revoke all on function public.listar_brain_insights() from public;
revoke all on function public.listar_brain_recommendations() from public;
revoke all on function public.recalcular_salud_modulos_empresa(uuid) from public;

grant execute on function public.current_company_has_active_module(text) to authenticated;
grant execute on function public.generar_brain_daily_metrics() to authenticated;
grant execute on function public.generar_brain_insights_basicos() to authenticated;
grant execute on function public.listar_brain_insights() to authenticated;
grant execute on function public.listar_brain_recommendations() to authenticated;
grant execute on function public.recalcular_salud_modulos_empresa(uuid) to service_role;

do $$
declare
  v_empresa_id uuid;
begin
  for v_empresa_id in select id from public.empresas loop
    perform public.recalcular_salud_modulos_empresa(v_empresa_id);
  end loop;
end;
$$;
