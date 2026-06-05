-- Business context is transversal company configuration.
-- Apply manually in Supabase SQL Editor. Do not run from the app.

create table if not exists public.business_context (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,

  business_summary text,
  mission text,
  vision text,
  core_values text,
  brand_personality text,
  tone_of_voice text,

  target_audience text,
  customer_pain_points text,
  geographic_scope text,
  competitors text,
  differentiators text,

  products_services text,
  main_offers text,
  pricing_notes text,
  service_process text,

  business_hours text,
  service_areas text,
  operational_rules text,
  sales_rules text,
  customer_service_rules text,

  preferred_cta text,
  keywords text,
  forbidden_topics text,
  required_disclaimers text,
  ai_instructions text,

  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_context_empresa_unique unique (empresa_id)
);

create index if not exists business_context_empresa_id_idx
  on public.business_context (empresa_id);

drop trigger if exists set_business_context_updated_at on public.business_context;
create trigger set_business_context_updated_at
before update on public.business_context
for each row execute function public.set_updated_at();

alter table public.business_context enable row level security;

grant select on public.business_context to authenticated;
grant insert on public.business_context to authenticated;
grant update on public.business_context to authenticated;

drop policy if exists business_context_select_permission on public.business_context;
create policy business_context_select_permission
on public.business_context
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
  )
);

drop policy if exists business_context_insert_permission on public.business_context;
create policy business_context_insert_permission
on public.business_context
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('admin.settings.manage')
);

drop policy if exists business_context_update_permission on public.business_context;
create policy business_context_update_permission
on public.business_context
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('admin.settings.manage')
)
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('admin.settings.manage')
);

create or replace function public.obtener_contexto_negocio()
returns table (
  id uuid,
  empresa_id uuid,
  business_summary text,
  mission text,
  vision text,
  core_values text,
  brand_personality text,
  tone_of_voice text,
  target_audience text,
  customer_pain_points text,
  geographic_scope text,
  competitors text,
  differentiators text,
  products_services text,
  main_offers text,
  pricing_notes text,
  service_process text,
  business_hours text,
  service_areas text,
  operational_rules text,
  sales_rules text,
  customer_service_rules text,
  preferred_cta text,
  keywords text,
  forbidden_topics text,
  required_disclaimers text,
  ai_instructions text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
  ) then
    raise exception 'Permiso de configuracion requerido.' using errcode = '42501';
  end if;

  return query
  select
    bc.id,
    bc.empresa_id,
    bc.business_summary,
    bc.mission,
    bc.vision,
    bc.core_values,
    bc.brand_personality,
    bc.tone_of_voice,
    bc.target_audience,
    bc.customer_pain_points,
    bc.geographic_scope,
    bc.competitors,
    bc.differentiators,
    bc.products_services,
    bc.main_offers,
    bc.pricing_notes,
    bc.service_process,
    bc.business_hours,
    bc.service_areas,
    bc.operational_rules,
    bc.sales_rules,
    bc.customer_service_rules,
    bc.preferred_cta,
    bc.keywords,
    bc.forbidden_topics,
    bc.required_disclaimers,
    bc.ai_instructions,
    bc.notes,
    bc.created_by,
    bc.updated_by,
    bc.created_at,
    bc.updated_at
  from public.business_context as bc
  where bc.empresa_id = v_empresa_id
  limit 1;
end;
$$;

create or replace function public.guardar_contexto_negocio(
  p_business_summary text default null,
  p_mission text default null,
  p_vision text default null,
  p_core_values text default null,
  p_brand_personality text default null,
  p_tone_of_voice text default null,
  p_target_audience text default null,
  p_customer_pain_points text default null,
  p_geographic_scope text default null,
  p_competitors text default null,
  p_differentiators text default null,
  p_products_services text default null,
  p_main_offers text default null,
  p_pricing_notes text default null,
  p_service_process text default null,
  p_business_hours text default null,
  p_service_areas text default null,
  p_operational_rules text default null,
  p_sales_rules text default null,
  p_customer_service_rules text default null,
  p_preferred_cta text default null,
  p_keywords text default null,
  p_forbidden_topics text default null,
  p_required_disclaimers text default null,
  p_ai_instructions text default null,
  p_notes text default null
)
returns table (
  id uuid,
  empresa_id uuid,
  business_summary text,
  mission text,
  vision text,
  core_values text,
  brand_personality text,
  tone_of_voice text,
  target_audience text,
  customer_pain_points text,
  geographic_scope text,
  competitors text,
  differentiators text,
  products_services text,
  main_offers text,
  pricing_notes text,
  service_process text,
  business_hours text,
  service_areas text,
  operational_rules text,
  sales_rules text,
  customer_service_rules text,
  preferred_cta text,
  keywords text,
  forbidden_topics text,
  required_disclaimers text,
  ai_instructions text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.business_context%rowtype;
  v_despues public.business_context%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  select bc.* into v_antes
  from public.business_context as bc
  where bc.empresa_id = v_empresa_id;

  insert into public.business_context (
    empresa_id,
    business_summary,
    mission,
    vision,
    core_values,
    brand_personality,
    tone_of_voice,
    target_audience,
    customer_pain_points,
    geographic_scope,
    competitors,
    differentiators,
    products_services,
    main_offers,
    pricing_notes,
    service_process,
    business_hours,
    service_areas,
    operational_rules,
    sales_rules,
    customer_service_rules,
    preferred_cta,
    keywords,
    forbidden_topics,
    required_disclaimers,
    ai_instructions,
    notes,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    nullif(btrim(coalesce(p_business_summary, '')), ''),
    nullif(btrim(coalesce(p_mission, '')), ''),
    nullif(btrim(coalesce(p_vision, '')), ''),
    nullif(btrim(coalesce(p_core_values, '')), ''),
    nullif(btrim(coalesce(p_brand_personality, '')), ''),
    nullif(btrim(coalesce(p_tone_of_voice, '')), ''),
    nullif(btrim(coalesce(p_target_audience, '')), ''),
    nullif(btrim(coalesce(p_customer_pain_points, '')), ''),
    nullif(btrim(coalesce(p_geographic_scope, '')), ''),
    nullif(btrim(coalesce(p_competitors, '')), ''),
    nullif(btrim(coalesce(p_differentiators, '')), ''),
    nullif(btrim(coalesce(p_products_services, '')), ''),
    nullif(btrim(coalesce(p_main_offers, '')), ''),
    nullif(btrim(coalesce(p_pricing_notes, '')), ''),
    nullif(btrim(coalesce(p_service_process, '')), ''),
    nullif(btrim(coalesce(p_business_hours, '')), ''),
    nullif(btrim(coalesce(p_service_areas, '')), ''),
    nullif(btrim(coalesce(p_operational_rules, '')), ''),
    nullif(btrim(coalesce(p_sales_rules, '')), ''),
    nullif(btrim(coalesce(p_customer_service_rules, '')), ''),
    nullif(btrim(coalesce(p_preferred_cta, '')), ''),
    nullif(btrim(coalesce(p_keywords, '')), ''),
    nullif(btrim(coalesce(p_forbidden_topics, '')), ''),
    nullif(btrim(coalesce(p_required_disclaimers, '')), ''),
    nullif(btrim(coalesce(p_ai_instructions, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_user_id,
    v_user_id
  )
  on conflict on constraint business_context_empresa_unique
  do update set
    business_summary = excluded.business_summary,
    mission = excluded.mission,
    vision = excluded.vision,
    core_values = excluded.core_values,
    brand_personality = excluded.brand_personality,
    tone_of_voice = excluded.tone_of_voice,
    target_audience = excluded.target_audience,
    customer_pain_points = excluded.customer_pain_points,
    geographic_scope = excluded.geographic_scope,
    competitors = excluded.competitors,
    differentiators = excluded.differentiators,
    products_services = excluded.products_services,
    main_offers = excluded.main_offers,
    pricing_notes = excluded.pricing_notes,
    service_process = excluded.service_process,
    business_hours = excluded.business_hours,
    service_areas = excluded.service_areas,
    operational_rules = excluded.operational_rules,
    sales_rules = excluded.sales_rules,
    customer_service_rules = excluded.customer_service_rules,
    preferred_cta = excluded.preferred_cta,
    keywords = excluded.keywords,
    forbidden_topics = excluded.forbidden_topics,
    required_disclaimers = excluded.required_disclaimers,
    ai_instructions = excluded.ai_instructions,
    notes = excluded.notes,
    updated_by = v_user_id,
    updated_at = now()
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'business_context',
    v_despues.id,
    'guardar_contexto_negocio',
    case when v_antes.id is null then null else to_jsonb(v_antes) end,
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.empresa_id,
    v_despues.business_summary,
    v_despues.mission,
    v_despues.vision,
    v_despues.core_values,
    v_despues.brand_personality,
    v_despues.tone_of_voice,
    v_despues.target_audience,
    v_despues.customer_pain_points,
    v_despues.geographic_scope,
    v_despues.competitors,
    v_despues.differentiators,
    v_despues.products_services,
    v_despues.main_offers,
    v_despues.pricing_notes,
    v_despues.service_process,
    v_despues.business_hours,
    v_despues.service_areas,
    v_despues.operational_rules,
    v_despues.sales_rules,
    v_despues.customer_service_rules,
    v_despues.preferred_cta,
    v_despues.keywords,
    v_despues.forbidden_topics,
    v_despues.required_disclaimers,
    v_despues.ai_instructions,
    v_despues.notes,
    v_despues.created_by,
    v_despues.updated_by,
    v_despues.created_at,
    v_despues.updated_at;
end;
$$;

revoke all on function public.obtener_contexto_negocio() from public;
revoke all on function public.guardar_contexto_negocio(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;

grant execute on function public.obtener_contexto_negocio() to authenticated;
grant execute on function public.guardar_contexto_negocio(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
