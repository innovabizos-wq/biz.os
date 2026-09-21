-- Whapp/Inbox production foundation for Meta compliance, pricing and classification.

create or replace function public.normalizar_inbox_identificador(
  p_canal text,
  p_identificador text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_canal, '')) = 'whatsapp'
      then nullif(regexp_replace(coalesce(p_identificador, ''), '[^0-9]', '', 'g'), '')
    else nullif(lower(btrim(coalesce(p_identificador, ''))), '')
  end;
$$;

create table if not exists public.inbox_contacto_preferencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal text not null,
  identificador text not null,
  identificador_normalizado text not null,
  estado text not null default 'desconocido',
  finalidad text not null default 'mensajeria_comercial',
  origen text,
  evidencia jsonb not null default '{}'::jsonb,
  version_aviso text,
  consentimiento_at timestamptz,
  baja_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_contacto_preferencias_canal_check
    check (canal in ('whatsapp', 'facebook', 'instagram')),
  constraint inbox_contacto_preferencias_estado_check
    check (estado in ('desconocido', 'consentido', 'baja')),
  constraint inbox_contacto_preferencias_unique
    unique (empresa_id, canal, identificador_normalizado, finalidad),
  constraint inbox_contacto_preferencias_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id),
  constraint inbox_contacto_preferencias_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id) references public.profiles(id, empresa_id)
);

create table if not exists public.inbox_consentimiento_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  preferencia_id uuid not null references public.inbox_contacto_preferencias(id) on delete cascade,
  estado text not null,
  origen text,
  evidencia jsonb not null default '{}'::jsonb,
  version_aviso text,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint inbox_consentimiento_eventos_estado_check
    check (estado in ('desconocido', 'consentido', 'baja')),
  constraint inbox_consentimiento_eventos_actor_empresa_fkey
    foreign key (actor_id, empresa_id) references public.profiles(id, empresa_id)
);

create index if not exists inbox_contacto_preferencias_estado_idx
  on public.inbox_contacto_preferencias (empresa_id, canal, estado);
create index if not exists inbox_consentimiento_eventos_preferencia_idx
  on public.inbox_consentimiento_eventos (empresa_id, preferencia_id, created_at desc);

create table if not exists public.inbox_meta_tarifas (
  id uuid primary key default gen_random_uuid(),
  market_code text not null,
  categoria text not null,
  currency text not null,
  unit_cost numeric(14, 6) not null,
  effective_from date not null,
  effective_to date,
  source_url text,
  created_at timestamptz not null default now(),
  constraint inbox_meta_tarifas_categoria_check
    check (categoria in ('AUTHENTICATION', 'AUTHENTICATION_INTERNATIONAL', 'MARKETING', 'UTILITY', 'SERVICE')),
  constraint inbox_meta_tarifas_cost_check check (unit_cost >= 0),
  constraint inbox_meta_tarifas_dates_check
    check (effective_to is null or effective_to >= effective_from),
  constraint inbox_meta_tarifas_unique
    unique (market_code, categoria, currency, effective_from)
);

create table if not exists public.inbox_meta_costos_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid references public.inbox_canales(id) on delete set null,
  mensaje_id uuid references public.inbox_mensajes(id) on delete set null,
  destinatario_campana_id uuid references public.inbox_campana_destinatarios(id) on delete set null,
  external_message_id text,
  categoria text,
  pricing_model text,
  market_code text,
  billable boolean,
  free_entry_point boolean not null default false,
  currency text,
  unit_cost numeric(14, 6),
  amount numeric(14, 6),
  estado text not null default 'pendiente_tarifa',
  pricing_payload jsonb not null default '{}'::jsonb,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_meta_costos_mensajes_estado_check
    check (estado in ('no_facturable', 'pendiente_tarifa', 'estimado', 'conciliado')),
  constraint inbox_meta_costos_mensajes_amount_check
    check ((unit_cost is null or unit_cost >= 0) and (amount is null or amount >= 0))
);

create unique index if not exists inbox_meta_costos_mensajes_external_unique
  on public.inbox_meta_costos_mensajes (empresa_id, external_message_id)
  where external_message_id is not null;
create index if not exists inbox_meta_costos_mensajes_period_idx
  on public.inbox_meta_costos_mensajes (empresa_id, created_at desc);

create table if not exists public.inbox_meta_politicas_envio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null,
  daily_limit integer not null default 1000,
  hourly_limit integer not null default 200,
  min_interval_ms integer not null default 250,
  max_failure_percent numeric(5, 2) not null default 10,
  require_active_consent boolean not null default true,
  require_recent_template_sync boolean not null default true,
  template_sync_max_age_hours integer not null default 168,
  quality_status text not null default 'UNKNOWN',
  paused_at timestamptz,
  pause_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_meta_politicas_envio_canal_empresa_fkey
    foreign key (canal_id, empresa_id) references public.inbox_canales(id, empresa_id) on delete cascade,
  constraint inbox_meta_politicas_envio_unique unique (empresa_id, canal_id),
  constraint inbox_meta_politicas_envio_limits_check
    check (daily_limit > 0 and hourly_limit > 0 and min_interval_ms >= 0),
  constraint inbox_meta_politicas_envio_quality_check
    check (quality_status in ('UNKNOWN', 'GREEN', 'YELLOW', 'RED'))
);

create table if not exists public.inbox_meta_oauth_propietarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null,
  meta_user_id text not null,
  proveedor text not null,
  granted_scopes text[] not null default '{}'::text[],
  token_expires_at timestamptz,
  last_validated_at timestamptz not null default now(),
  granted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_meta_oauth_propietarios_canal_empresa_fkey
    foreign key (canal_id, empresa_id) references public.inbox_canales(id, empresa_id) on delete cascade,
  constraint inbox_meta_oauth_propietarios_granted_by_empresa_fkey
    foreign key (granted_by, empresa_id) references public.profiles(id, empresa_id) on delete set null,
  constraint inbox_meta_oauth_propietarios_provider_check
    check (proveedor in ('facebook', 'instagram')),
  constraint inbox_meta_oauth_propietarios_unique unique (empresa_id, canal_id, meta_user_id)
);

create index if not exists inbox_meta_oauth_propietarios_user_idx
  on public.inbox_meta_oauth_propietarios (meta_user_id);

create table if not exists public.inbox_meta_data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  subject_hash text not null,
  estado text not null default 'completada',
  affected_channels integer not null default 0,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint inbox_meta_data_deletion_requests_estado_check
    check (estado in ('recibida', 'procesando', 'completada', 'fallida'))
);

alter table public.inbox_meta_plantillas
  add column if not exists meta_status text,
  add column if not exists meta_category text,
  add column if not exists quality_score jsonb not null default '{}'::jsonb,
  add column if not exists last_synced_at timestamptz,
  add column if not exists sync_error text,
  add column if not exists disabled_at timestamptz;

alter table public.inbox_campana_destinatarios
  add column if not exists consentimiento_id uuid references public.inbox_contacto_preferencias(id) on delete set null,
  add column if not exists pricing_category text,
  add column if not exists pricing_model text,
  add column if not exists market_code text,
  add column if not exists billable boolean,
  add column if not exists free_entry_point boolean not null default false,
  add column if not exists currency text,
  add column if not exists unit_cost numeric(14, 6),
  add column if not exists actual_cost numeric(14, 6),
  add column if not exists billing_status text not null default 'pendiente';

alter table public.inbox_campanas
  add column if not exists estimated_cost numeric(14, 6) not null default 0,
  add column if not exists actual_cost numeric(14, 6) not null default 0,
  add column if not exists cost_currency text,
  add column if not exists billing_status text not null default 'pendiente';

create table if not exists public.inbox_etiquetas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  color text not null default '#64748b',
  activa boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_etiquetas_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
);

create unique index if not exists inbox_etiquetas_nombre_unique
  on public.inbox_etiquetas (empresa_id, lower(nombre));

create table if not exists public.inbox_conversacion_etiquetas (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversacion_id uuid not null,
  etiqueta_id uuid not null references public.inbox_etiquetas(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (conversacion_id, etiqueta_id),
  constraint inbox_conversacion_etiquetas_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id) references public.inbox_conversaciones(id, empresa_id) on delete cascade,
  constraint inbox_conversacion_etiquetas_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
);

create table if not exists public.inbox_funnels (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  activo boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_funnels_nombre_unique unique (empresa_id, nombre),
  constraint inbox_funnels_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
);

create table if not exists public.inbox_funnel_etapas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funnel_id uuid not null references public.inbox_funnels(id) on delete cascade,
  nombre text not null,
  posicion integer not null default 0,
  color text not null default '#64748b',
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_funnel_etapas_unique unique (funnel_id, nombre),
  constraint inbox_funnel_etapas_position_unique unique (funnel_id, posicion) deferrable initially deferred,
  constraint inbox_funnel_etapas_position_check check (posicion >= 0)
);

create table if not exists public.inbox_conversacion_funnel (
  conversacion_id uuid primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  funnel_id uuid not null references public.inbox_funnels(id) on delete cascade,
  etapa_id uuid not null references public.inbox_funnel_etapas(id) on delete cascade,
  entered_at timestamptz not null default now(),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint inbox_conversacion_funnel_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id) references public.inbox_conversaciones(id, empresa_id) on delete cascade,
  constraint inbox_conversacion_funnel_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id) references public.profiles(id, empresa_id)
);

create index if not exists inbox_conversacion_etiquetas_empresa_idx
  on public.inbox_conversacion_etiquetas (empresa_id, etiqueta_id);
create index if not exists inbox_funnel_etapas_empresa_idx
  on public.inbox_funnel_etapas (empresa_id, funnel_id, posicion);
create index if not exists inbox_conversacion_funnel_etapa_idx
  on public.inbox_conversacion_funnel (empresa_id, etapa_id);

drop trigger if exists set_inbox_contacto_preferencias_updated_at on public.inbox_contacto_preferencias;
create trigger set_inbox_contacto_preferencias_updated_at
before update on public.inbox_contacto_preferencias
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_meta_costos_mensajes_updated_at on public.inbox_meta_costos_mensajes;
create trigger set_inbox_meta_costos_mensajes_updated_at
before update on public.inbox_meta_costos_mensajes
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_meta_politicas_envio_updated_at on public.inbox_meta_politicas_envio;
create trigger set_inbox_meta_politicas_envio_updated_at
before update on public.inbox_meta_politicas_envio
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_meta_oauth_propietarios_updated_at on public.inbox_meta_oauth_propietarios;
create trigger set_inbox_meta_oauth_propietarios_updated_at
before update on public.inbox_meta_oauth_propietarios
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_etiquetas_updated_at on public.inbox_etiquetas;
create trigger set_inbox_etiquetas_updated_at
before update on public.inbox_etiquetas
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_funnels_updated_at on public.inbox_funnels;
create trigger set_inbox_funnels_updated_at
before update on public.inbox_funnels
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_funnel_etapas_updated_at on public.inbox_funnel_etapas;
create trigger set_inbox_funnel_etapas_updated_at
before update on public.inbox_funnel_etapas
for each row execute function public.set_updated_at();
drop trigger if exists set_inbox_conversacion_funnel_updated_at on public.inbox_conversacion_funnel;
create trigger set_inbox_conversacion_funnel_updated_at
before update on public.inbox_conversacion_funnel
for each row execute function public.set_updated_at();

alter table public.inbox_contacto_preferencias enable row level security;
alter table public.inbox_consentimiento_eventos enable row level security;
alter table public.inbox_meta_tarifas enable row level security;
alter table public.inbox_meta_costos_mensajes enable row level security;
alter table public.inbox_meta_politicas_envio enable row level security;
alter table public.inbox_meta_oauth_propietarios enable row level security;
alter table public.inbox_meta_data_deletion_requests enable row level security;
alter table public.inbox_etiquetas enable row level security;
alter table public.inbox_conversacion_etiquetas enable row level security;
alter table public.inbox_funnels enable row level security;
alter table public.inbox_funnel_etapas enable row level security;
alter table public.inbox_conversacion_funnel enable row level security;

grant select on public.inbox_contacto_preferencias, public.inbox_consentimiento_eventos,
  public.inbox_meta_costos_mensajes, public.inbox_meta_politicas_envio,
  public.inbox_etiquetas, public.inbox_conversacion_etiquetas, public.inbox_funnels,
  public.inbox_funnel_etapas, public.inbox_conversacion_funnel to authenticated;
grant select on public.inbox_meta_tarifas to authenticated;
grant select, insert, update on public.inbox_contacto_preferencias,
  public.inbox_meta_costos_mensajes, public.inbox_meta_politicas_envio,
  public.inbox_meta_oauth_propietarios,
  public.inbox_etiquetas, public.inbox_conversacion_etiquetas, public.inbox_funnels,
  public.inbox_funnel_etapas, public.inbox_conversacion_funnel to service_role;
grant select, insert on public.inbox_consentimiento_eventos to service_role;
grant select, insert, update on public.inbox_meta_tarifas to service_role;
grant select, insert, update on public.inbox_meta_oauth_propietarios to service_role;
grant select, insert, update on public.inbox_meta_data_deletion_requests to service_role;

create policy inbox_contacto_preferencias_select on public.inbox_contacto_preferencias
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_consentimiento_eventos_select on public.inbox_consentimiento_eventos
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_meta_costos_mensajes_select on public.inbox_meta_costos_mensajes
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.view')
);
create policy inbox_meta_politicas_envio_select on public.inbox_meta_politicas_envio
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.view')
);
create policy inbox_etiquetas_select on public.inbox_etiquetas
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_conversacion_etiquetas_select on public.inbox_conversacion_etiquetas
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_funnels_select on public.inbox_funnels
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_funnel_etapas_select on public.inbox_funnel_etapas
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_conversacion_funnel_select on public.inbox_conversacion_funnel
for select to authenticated using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);
create policy inbox_meta_tarifas_select on public.inbox_meta_tarifas
for select to authenticated using (
  public.current_user_is_platform_user(array['owner', 'admin'])
);

create or replace function public.procesar_meta_data_deletion_server(
  p_meta_user_id text,
  p_subject_hash text,
  p_confirmation_code text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel_ids uuid[];
  v_secret_ids uuid[];
  v_affected integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role requerido.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_meta_user_id, '')), '') is null
    or nullif(btrim(coalesce(p_subject_hash, '')), '') is null
    or nullif(btrim(coalesce(p_confirmation_code, '')), '') is null then
    raise exception 'Solicitud de eliminacion incompleta.' using errcode = '22023';
  end if;

  insert into public.inbox_meta_data_deletion_requests (
    confirmation_code, subject_hash, estado
  ) values (
    p_confirmation_code, p_subject_hash, 'procesando'
  );

  select coalesce(array_agg(distinct canal_id), array[]::uuid[])
    into v_channel_ids
  from public.inbox_meta_oauth_propietarios
  where meta_user_id = p_meta_user_id;

  v_affected := coalesce(array_length(v_channel_ids, 1), 0);
  if v_affected > 0 then
    select array_remove(array_agg(secret_id), null)
      into v_secret_ids
    from (
      select access_token_secret_id as secret_id
      from public.inbox_canal_secretos where canal_id = any(v_channel_ids)
      union all
      select app_secret_secret_id
      from public.inbox_canal_secretos where canal_id = any(v_channel_ids)
      union all
      select verify_token_secret_id
      from public.inbox_canal_secretos where canal_id = any(v_channel_ids)
    ) as refs;

    if to_regclass('vault.secrets') is not null and coalesce(array_length(v_secret_ids, 1), 0) > 0 then
      execute 'delete from vault.secrets where id = any($1)' using v_secret_ids;
    end if;

    delete from public.inbox_canal_secretos where canal_id = any(v_channel_ids);
    update public.inbox_canales
    set estado = 'inactivo', conexion_estado = 'inactivo', proveedor_estado = 'data_deleted'
    where id = any(v_channel_ids);
    delete from public.inbox_meta_oauth_propietarios where meta_user_id = p_meta_user_id;
  end if;

  update public.inbox_meta_data_deletion_requests
  set estado = 'completada', affected_channels = v_affected, completed_at = now()
  where confirmation_code = p_confirmation_code;

  return v_affected;
exception
  when others then
    update public.inbox_meta_data_deletion_requests
    set estado = 'fallida', completed_at = now()
    where confirmation_code = p_confirmation_code;
    raise;
end;
$$;

create or replace function public.registrar_inbox_preferencia_contacto(
  p_canal text,
  p_identificador text,
  p_estado text,
  p_origen text default null,
  p_finalidad text default 'mensajeria_comercial',
  p_evidencia jsonb default '{}'::jsonb,
  p_version_aviso text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_actor_id uuid := auth.uid();
  v_normalizado text;
  v_preferencia_id uuid;
begin
  if v_empresa_id is null or v_actor_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not (
    public.current_user_has_permission('inbox.channels.manage')
    or public.current_user_has_permission('inbox.conversations.reply')
  ) then
    raise exception 'Permiso de Inbox requerido.' using errcode = '42501';
  end if;
  if p_canal not in ('whatsapp', 'facebook', 'instagram')
    or p_estado not in ('desconocido', 'consentido', 'baja') then
    raise exception 'Canal o estado de consentimiento invalido.' using errcode = '22023';
  end if;

  v_normalizado := public.normalizar_inbox_identificador(p_canal, p_identificador);
  if v_normalizado is null then
    raise exception 'Identificador de contacto requerido.' using errcode = '22023';
  end if;

  insert into public.inbox_contacto_preferencias (
    empresa_id, canal, identificador, identificador_normalizado, estado,
    finalidad, origen, evidencia, version_aviso, consentimiento_at, baja_at,
    created_by, updated_by
  ) values (
    v_empresa_id, p_canal, p_identificador, v_normalizado, p_estado,
    coalesce(nullif(btrim(p_finalidad), ''), 'mensajeria_comercial'),
    nullif(btrim(coalesce(p_origen, '')), ''), coalesce(p_evidencia, '{}'::jsonb),
    nullif(btrim(coalesce(p_version_aviso, '')), ''),
    case when p_estado = 'consentido' then now() else null end,
    case when p_estado = 'baja' then now() else null end,
    v_actor_id, v_actor_id
  )
  on conflict (empresa_id, canal, identificador_normalizado, finalidad)
  do update set
    identificador = excluded.identificador,
    estado = excluded.estado,
    origen = excluded.origen,
    evidencia = excluded.evidencia,
    version_aviso = excluded.version_aviso,
    consentimiento_at = case
      when excluded.estado = 'consentido' then now()
      else public.inbox_contacto_preferencias.consentimiento_at
    end,
    baja_at = case
      when excluded.estado = 'baja' then now()
      when excluded.estado = 'consentido' then null
      else public.inbox_contacto_preferencias.baja_at
    end,
    updated_by = v_actor_id,
    updated_at = now()
  returning id into v_preferencia_id;

  insert into public.inbox_consentimiento_eventos (
    empresa_id, preferencia_id, estado, origen, evidencia, version_aviso, actor_id
  ) values (
    v_empresa_id, v_preferencia_id, p_estado, p_origen,
    coalesce(p_evidencia, '{}'::jsonb), p_version_aviso, v_actor_id
  );

  if p_estado = 'baja' and p_canal = 'whatsapp' then
    update public.inbox_campana_destinatarios
    set estado = 'excluido',
        last_error = 'Contacto excluido por solicitud de baja.'
    where empresa_id = v_empresa_id
      and public.normalizar_inbox_identificador('whatsapp', telefono) = v_normalizado
      and estado in ('pendiente', 'listo', 'en_cola');
  end if;

  return v_preferencia_id;
end;
$$;

create or replace function public.actualizar_inbox_clasificacion(
  p_conversacion_id uuid,
  p_etiquetas text[] default '{}'::text[],
  p_etapa_funnel text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_actor_id uuid := auth.uid();
  v_etiqueta text;
  v_etiqueta_id uuid;
  v_funnel_id uuid;
  v_etapa_id uuid;
begin
  if v_empresa_id is null or v_actor_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inbox.conversations.assign') then
    raise exception 'Permiso inbox.conversations.assign requerido.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.inbox_conversaciones
    where id = p_conversacion_id and empresa_id = v_empresa_id
  ) then
    raise exception 'Conversacion no encontrada.' using errcode = 'P0002';
  end if;

  delete from public.inbox_conversacion_etiquetas
  where empresa_id = v_empresa_id and conversacion_id = p_conversacion_id;

  foreach v_etiqueta in array coalesce(p_etiquetas, '{}'::text[])
  loop
    v_etiqueta := nullif(btrim(v_etiqueta), '');
    if v_etiqueta is null then continue; end if;
    insert into public.inbox_etiquetas (empresa_id, nombre, created_by)
    values (v_empresa_id, left(v_etiqueta, 80), v_actor_id)
    on conflict (empresa_id, (lower(nombre))) do update set activa = true
    returning id into v_etiqueta_id;

    insert into public.inbox_conversacion_etiquetas (
      empresa_id, conversacion_id, etiqueta_id, created_by
    ) values (v_empresa_id, p_conversacion_id, v_etiqueta_id, v_actor_id)
    on conflict do nothing;
  end loop;

  if nullif(btrim(coalesce(p_etapa_funnel, '')), '') is null then
    delete from public.inbox_conversacion_funnel
    where empresa_id = v_empresa_id and conversacion_id = p_conversacion_id;
  else
    if btrim(p_etapa_funnel) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      select e.id, e.funnel_id into v_etapa_id, v_funnel_id
      from public.inbox_funnel_etapas as e
      join public.inbox_funnels as f on f.id = e.funnel_id and f.empresa_id = e.empresa_id
      where e.id = btrim(p_etapa_funnel)::uuid
        and e.empresa_id = v_empresa_id and e.activa and f.activo;
      if v_etapa_id is null then raise exception 'Etapa de funnel no encontrada.' using errcode = 'P0002'; end if;
    else
      insert into public.inbox_funnels (empresa_id, nombre, created_by)
      values (v_empresa_id, 'Ventas', v_actor_id)
      on conflict (empresa_id, nombre) do update set activo = true
      returning id into v_funnel_id;

      select id into v_etapa_id
      from public.inbox_funnel_etapas
      where funnel_id = v_funnel_id
        and lower(nombre) = lower(left(btrim(p_etapa_funnel), 120));

      if v_etapa_id is null then
        insert into public.inbox_funnel_etapas (
          empresa_id, funnel_id, nombre, posicion
        ) values (
          v_empresa_id, v_funnel_id, left(btrim(p_etapa_funnel), 120),
          coalesce((select max(posicion) + 1 from public.inbox_funnel_etapas where funnel_id = v_funnel_id), 0)
        ) returning id into v_etapa_id;
      end if;
    end if;

    insert into public.inbox_conversacion_funnel (
      conversacion_id, empresa_id, funnel_id, etapa_id, updated_by
    ) values (
      p_conversacion_id, v_empresa_id, v_funnel_id, v_etapa_id, v_actor_id
    )
    on conflict (conversacion_id) do update set
      funnel_id = excluded.funnel_id,
      etapa_id = excluded.etapa_id,
      entered_at = case
        when public.inbox_conversacion_funnel.etapa_id <> excluded.etapa_id then now()
        else public.inbox_conversacion_funnel.entered_at
      end,
      updated_by = v_actor_id,
      updated_at = now();
  end if;

  insert into public.inbox_eventos (
    empresa_id, conversacion_id, tipo, descripcion, metadata, created_by
  ) values (
    v_empresa_id, p_conversacion_id, 'clasificacion_widget',
    'Clasificacion operativa actualizada.',
    jsonb_build_object('etiquetas', coalesce(p_etiquetas, '{}'::text[]), 'etapaFunnel', p_etapa_funnel),
    v_actor_id
  );
end;
$$;

create or replace function public.upsert_inbox_etiqueta(
  p_etiqueta_id uuid,
  p_nombre text,
  p_color text default '#64748b',
  p_activa boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  if v_empresa_id is null or v_actor_id is null
    or not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_nombre, '')), '') is null
    or coalesce(p_color, '') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Etiqueta invalida.' using errcode = '22023';
  end if;

  if p_etiqueta_id is null then
    insert into public.inbox_etiquetas (empresa_id, nombre, color, activa, created_by)
    values (v_empresa_id, btrim(p_nombre), lower(p_color), p_activa, v_actor_id)
    on conflict (empresa_id, (lower(nombre))) do update
      set color = excluded.color, activa = excluded.activa
    returning id into v_id;
  else
    update public.inbox_etiquetas
    set nombre = btrim(p_nombre), color = lower(p_color), activa = p_activa
    where id = p_etiqueta_id and empresa_id = v_empresa_id
    returning id into v_id;
  end if;
  if v_id is null then raise exception 'Etiqueta no encontrada.' using errcode = '02000'; end if;
  return v_id;
end;
$$;

create or replace function public.upsert_inbox_funnel_etapa(
  p_funnel_id uuid,
  p_funnel_nombre text,
  p_etapa_id uuid,
  p_etapa_nombre text,
  p_posicion integer,
  p_color text default '#64748b'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_actor_id uuid := auth.uid();
  v_funnel_id uuid;
  v_etapa_id uuid;
  v_old_position integer;
  v_position integer;
  v_count integer;
begin
  if v_empresa_id is null or v_actor_id is null
    or not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_etapa_nombre, '')), '') is null
    or coalesce(p_color, '') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Etapa invalida.' using errcode = '22023';
  end if;

  if p_funnel_id is not null then
    select id into v_funnel_id from public.inbox_funnels
    where id = p_funnel_id and empresa_id = v_empresa_id;
  else
    if nullif(btrim(coalesce(p_funnel_nombre, '')), '') is null then
      raise exception 'Nombre de funnel requerido.' using errcode = '22023';
    end if;
    insert into public.inbox_funnels (empresa_id, nombre, created_by)
    values (v_empresa_id, btrim(p_funnel_nombre), v_actor_id)
    on conflict (empresa_id, nombre) do update set activo = true
    returning id into v_funnel_id;
  end if;
  if v_funnel_id is null then raise exception 'Funnel no encontrado.' using errcode = '02000'; end if;

  set constraints inbox_funnel_etapas_position_unique deferred;
  select count(*) into v_count from public.inbox_funnel_etapas where funnel_id = v_funnel_id;
  v_position := greatest(0, least(coalesce(p_posicion, v_count), v_count));

  if p_etapa_id is null then
    update public.inbox_funnel_etapas set posicion = posicion + 1
    where funnel_id = v_funnel_id and posicion >= v_position;
    insert into public.inbox_funnel_etapas (empresa_id, funnel_id, nombre, posicion, color)
    values (v_empresa_id, v_funnel_id, btrim(p_etapa_nombre), v_position, lower(p_color))
    returning id into v_etapa_id;
  else
    select posicion into v_old_position from public.inbox_funnel_etapas
    where id = p_etapa_id and empresa_id = v_empresa_id and funnel_id = v_funnel_id;
    if v_old_position is null then raise exception 'Etapa no encontrada.' using errcode = '02000'; end if;
    if v_position < v_old_position then
      update public.inbox_funnel_etapas set posicion = posicion + 1
      where funnel_id = v_funnel_id and posicion >= v_position and posicion < v_old_position;
    elsif v_position > v_old_position then
      update public.inbox_funnel_etapas set posicion = posicion - 1
      where funnel_id = v_funnel_id and posicion > v_old_position and posicion <= v_position;
    end if;
    update public.inbox_funnel_etapas
    set nombre = btrim(p_etapa_nombre), posicion = v_position, color = lower(p_color), activa = true
    where id = p_etapa_id
    returning id into v_etapa_id;
  end if;
  return v_etapa_id;
end;
$$;

create or replace function public.detectar_inbox_baja_desde_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.inbox_conversaciones%rowtype;
  v_normalizado text;
  v_preferencia_id uuid;
  v_texto text;
begin
  if new.direccion <> 'entrante' or new.es_nota_interna or new.tipo <> 'texto' then
    return new;
  end if;

  v_texto := lower(btrim(coalesce(new.contenido, '')));
  if v_texto !~ '^(stop|alto|salir|baja|cancelar|cancelar suscripci[oó]n|no mensajes|no quiero m[aá]s mensajes)$' then
    return new;
  end if;

  select * into v_conversacion
  from public.inbox_conversaciones
  where id = new.conversacion_id and empresa_id = new.empresa_id;

  if v_conversacion.id is null or v_conversacion.canal not in ('whatsapp', 'facebook', 'instagram') then
    return new;
  end if;

  v_normalizado := public.normalizar_inbox_identificador(
    v_conversacion.canal,
    coalesce(v_conversacion.contacto_telefono, v_conversacion.contacto_identificador, v_conversacion.contacto_usuario)
  );
  if v_normalizado is null then return new; end if;

  insert into public.inbox_contacto_preferencias (
    empresa_id, canal, identificador, identificador_normalizado, estado,
    finalidad, origen, evidencia, baja_at
  ) values (
    new.empresa_id, v_conversacion.canal, v_normalizado, v_normalizado, 'baja',
    'toda_mensajeria', 'mensaje_entrante',
    jsonb_build_object('mensaje_id', new.id, 'texto', new.contenido), now()
  )
  on conflict (empresa_id, canal, identificador_normalizado, finalidad)
  do update set estado = 'baja', origen = 'mensaje_entrante',
    evidencia = excluded.evidencia, baja_at = now(), updated_at = now()
  returning id into v_preferencia_id;

  insert into public.inbox_consentimiento_eventos (
    empresa_id, preferencia_id, estado, origen, evidencia
  ) values (
    new.empresa_id, v_preferencia_id, 'baja', 'mensaje_entrante',
    jsonb_build_object('mensaje_id', new.id, 'texto', new.contenido)
  );

  if v_conversacion.canal = 'whatsapp' then
    update public.inbox_campana_destinatarios
    set estado = 'excluido', last_error = 'Contacto excluido por solicitud de baja.'
    where empresa_id = new.empresa_id
      and public.normalizar_inbox_identificador('whatsapp', telefono) = v_normalizado
      and estado in ('pendiente', 'listo', 'en_cola');
  end if;

  return new;
end;
$$;

create or replace function public.registrar_inbox_consentimiento_servicio_inbound()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.inbox_conversaciones%rowtype;
  v_normalizado text;
  v_preferencia_id uuid;
begin
  if new.direccion <> 'entrante' or new.es_nota_interna then return new; end if;
  if new.tipo = 'texto' and lower(btrim(coalesce(new.contenido, ''))) ~
    '^(stop|alto|salir|baja|cancelar|cancelar suscripci[oó]n|no mensajes|no quiero m[aá]s mensajes)$' then
    return new;
  end if;

  select * into v_conversacion
  from public.inbox_conversaciones
  where id = new.conversacion_id and empresa_id = new.empresa_id;
  if v_conversacion.id is null or v_conversacion.canal not in ('whatsapp', 'facebook', 'instagram') then
    return new;
  end if;

  v_normalizado := public.normalizar_inbox_identificador(
    v_conversacion.canal,
    coalesce(v_conversacion.contacto_telefono, v_conversacion.contacto_identificador, v_conversacion.contacto_usuario)
  );
  if v_normalizado is null then return new; end if;

  insert into public.inbox_contacto_preferencias (
    empresa_id, canal, identificador, identificador_normalizado, estado,
    finalidad, origen, evidencia, consentimiento_at
  ) values (
    new.empresa_id, v_conversacion.canal, v_normalizado, v_normalizado, 'consentido',
    'mensajeria_servicio', 'mensaje_entrante',
    jsonb_build_object('mensaje_id', new.id), coalesce(new.received_at, new.created_at, now())
  )
  on conflict (empresa_id, canal, identificador_normalizado, finalidad)
  do update set estado = 'consentido', origen = 'mensaje_entrante',
    evidencia = excluded.evidencia,
    consentimiento_at = excluded.consentimiento_at,
    baja_at = null,
    updated_at = now()
  returning id into v_preferencia_id;

  insert into public.inbox_consentimiento_eventos (
    empresa_id, preferencia_id, estado, origen, evidencia
  ) values (
    new.empresa_id, v_preferencia_id, 'consentido', 'mensaje_entrante',
    jsonb_build_object('mensaje_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists detect_inbox_opt_out_from_message on public.inbox_mensajes;
create trigger detect_inbox_opt_out_from_message
after insert on public.inbox_mensajes
for each row execute function public.detectar_inbox_baja_desde_mensaje();

drop trigger if exists register_inbox_service_consent_from_message on public.inbox_mensajes;
create trigger register_inbox_service_consent_from_message
after insert on public.inbox_mensajes
for each row execute function public.registrar_inbox_consentimiento_servicio_inbound();

create or replace function public.sincronizar_inbox_meta_costo_desde_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_billable boolean;
  v_categoria text;
  v_model text;
  v_mensaje_id uuid;
  v_destinatario_id uuid;
  v_campana_id uuid;
  v_market_code text;
  v_currency text;
  v_unit_cost numeric(14, 6);
  v_amount numeric(14, 6);
  v_delivered_at timestamptz;
begin
  if new.event_type <> 'status' or new.external_message_id is null or new.empresa_id is null then
    return new;
  end if;

  if new.payload#>'{status,pricing}' is null then
    return new;
  end if;

  v_billable := lower(coalesce(new.payload#>>'{status,pricing,billable}', '')) = 'true';
  v_categoria := upper(nullif(new.payload#>>'{status,pricing,category}', ''));
  v_model := nullif(new.payload#>>'{status,pricing,pricing_model}', '');
  v_delivered_at := case
    when new.payload#>>'{status,status}' in ('delivered', 'read')
      and nullif(new.payload#>>'{status,timestamp}', '') is not null
    then to_timestamp((new.payload#>>'{status,timestamp}')::double precision)
    else null
  end;

  select id into v_mensaje_id
  from public.inbox_mensajes
  where empresa_id = new.empresa_id and canal_message_id = new.external_message_id
  order by created_at desc limit 1;

  select id, campana_id, market_code
    into v_destinatario_id, v_campana_id, v_market_code
  from public.inbox_campana_destinatarios
  where empresa_id = new.empresa_id and canal_message_id = new.external_message_id
  order by created_at desc limit 1;

  if v_billable and v_market_code is not null and v_categoria is not null then
    select currency, unit_cost into v_currency, v_unit_cost
    from public.inbox_meta_tarifas
    where market_code = upper(v_market_code)
      and categoria = v_categoria
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by effective_from desc
    limit 1;
    v_amount := v_unit_cost;
  end if;

  insert into public.inbox_meta_costos_mensajes (
    empresa_id, canal_id, mensaje_id, destinatario_campana_id,
    external_message_id, categoria, pricing_model, market_code, billable,
    currency, unit_cost, amount, estado, pricing_payload, delivered_at
  ) values (
    new.empresa_id, new.canal_id, v_mensaje_id, v_destinatario_id,
    new.external_message_id, v_categoria, v_model, v_market_code, v_billable,
    v_currency, v_unit_cost, v_amount,
    case when not v_billable then 'no_facturable' when v_amount is not null then 'estimado' else 'pendiente_tarifa' end,
    coalesce(new.payload#>'{status,pricing}', '{}'::jsonb), v_delivered_at
  )
  on conflict (empresa_id, external_message_id) where external_message_id is not null
  do update set
    categoria = coalesce(excluded.categoria, public.inbox_meta_costos_mensajes.categoria),
    pricing_model = coalesce(excluded.pricing_model, public.inbox_meta_costos_mensajes.pricing_model),
    market_code = coalesce(excluded.market_code, public.inbox_meta_costos_mensajes.market_code),
    billable = excluded.billable,
    currency = coalesce(excluded.currency, public.inbox_meta_costos_mensajes.currency),
    unit_cost = coalesce(excluded.unit_cost, public.inbox_meta_costos_mensajes.unit_cost),
    amount = coalesce(excluded.amount, public.inbox_meta_costos_mensajes.amount),
    estado = excluded.estado,
    pricing_payload = excluded.pricing_payload,
    delivered_at = coalesce(excluded.delivered_at, public.inbox_meta_costos_mensajes.delivered_at),
    updated_at = now();

  update public.inbox_campana_destinatarios
  set pricing_category = coalesce(v_categoria, pricing_category),
      pricing_model = coalesce(v_model, pricing_model),
      currency = coalesce(v_currency, currency),
      unit_cost = coalesce(v_unit_cost, unit_cost),
      actual_cost = coalesce(v_amount, actual_cost),
      billable = v_billable,
      billing_status = case when not v_billable then 'no_facturable' when v_amount is not null then 'estimado' else 'pendiente_tarifa' end
  where id = v_destinatario_id;

  if v_campana_id is not null then
    update public.inbox_campanas as c
    set actual_cost = coalesce((
          select sum(coalesce(d.actual_cost, 0))
          from public.inbox_campana_destinatarios as d
          where d.campana_id = v_campana_id and d.empresa_id = new.empresa_id
        ), 0),
        cost_currency = coalesce(v_currency, c.cost_currency),
        billing_status = case
          when exists (
            select 1 from public.inbox_campana_destinatarios as d
            where d.campana_id = v_campana_id and d.billing_status = 'pendiente_tarifa'
          ) then 'pendiente_tarifa'
          else 'estimado'
        end
    where c.id = v_campana_id and c.empresa_id = new.empresa_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inbox_meta_cost_from_status on public.inbox_webhook_eventos;
create trigger sync_inbox_meta_cost_from_status
after insert on public.inbox_webhook_eventos
for each row execute function public.sincronizar_inbox_meta_costo_desde_status();

revoke all on function public.normalizar_inbox_identificador(text, text) from public;
grant execute on function public.normalizar_inbox_identificador(text, text) to authenticated, service_role;
revoke all on function public.registrar_inbox_preferencia_contacto(text, text, text, text, text, jsonb, text) from public;
grant execute on function public.registrar_inbox_preferencia_contacto(text, text, text, text, text, jsonb, text) to authenticated;
revoke all on function public.actualizar_inbox_clasificacion(uuid, text[], text) from public;
grant execute on function public.actualizar_inbox_clasificacion(uuid, text[], text) to authenticated;
revoke all on function public.upsert_inbox_etiqueta(uuid, text, text, boolean) from public;
grant execute on function public.upsert_inbox_etiqueta(uuid, text, text, boolean) to authenticated;
revoke all on function public.upsert_inbox_funnel_etapa(uuid, text, uuid, text, integer, text) from public;
grant execute on function public.upsert_inbox_funnel_etapa(uuid, text, uuid, text, integer, text) to authenticated;
revoke all on function public.detectar_inbox_baja_desde_mensaje() from public;
revoke all on function public.registrar_inbox_consentimiento_servicio_inbound() from public;
revoke all on function public.sincronizar_inbox_meta_costo_desde_status() from public;
revoke all on function public.procesar_meta_data_deletion_server(text, text, text) from public;
grant execute on function public.procesar_meta_data_deletion_server(text, text, text) to service_role;
