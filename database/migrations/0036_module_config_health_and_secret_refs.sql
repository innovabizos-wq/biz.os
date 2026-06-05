-- Module health contract and non-destructive secret reference columns.
-- Keeps existing inline Meta credentials while allowing a later Vault migration.

alter table public.inbox_canal_secretos
  add column if not exists access_token_secret_id uuid,
  add column if not exists app_secret_secret_id uuid,
  add column if not exists verify_token_secret_id uuid,
  add column if not exists secret_storage text not null default 'inline',
  add column if not exists secrets_migrated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inbox_canal_secretos_secret_storage_check'
      and conrelid = 'public.inbox_canal_secretos'::regclass
  ) then
    alter table public.inbox_canal_secretos
      add constraint inbox_canal_secretos_secret_storage_check
      check (secret_storage in ('inline', 'vault', 'mixed'));
  end if;
end;
$$;

update public.inbox_canal_secretos
set secret_storage = case
  when access_token_secret_id is not null
    or app_secret_secret_id is not null
    or verify_token_secret_id is not null then 'mixed'
  else 'inline'
end
where secret_storage is null
  or secret_storage not in ('inline', 'vault', 'mixed');

create index if not exists inbox_canal_secretos_secret_storage_idx
  on public.inbox_canal_secretos (empresa_id, secret_storage);

create table if not exists public.empresa_modulo_health (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  modulo_codigo text not null references public.modulos(codigo) on update cascade on delete restrict,
  status text not null default 'unknown',
  configuration_complete boolean not null default false,
  credentials_present boolean not null default false,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint empresa_modulo_health_status_check
    check (status in ('unknown', 'healthy', 'misconfigured', 'unhealthy', 'inactive')),
  constraint empresa_modulo_health_unique
    unique (empresa_id, modulo_codigo)
);

create index if not exists empresa_modulo_health_empresa_idx
  on public.empresa_modulo_health (empresa_id);

create index if not exists empresa_modulo_health_modulo_status_idx
  on public.empresa_modulo_health (modulo_codigo, status);

drop trigger if exists set_empresa_modulo_health_updated_at
on public.empresa_modulo_health;

create trigger set_empresa_modulo_health_updated_at
before update on public.empresa_modulo_health
for each row
execute function public.set_updated_at();

alter table public.empresa_modulo_health enable row level security;

grant select on public.empresa_modulo_health to authenticated;

drop policy if exists empresa_modulo_health_select_admin on public.empresa_modulo_health;
create policy empresa_modulo_health_select_admin
on public.empresa_modulo_health
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
  )
);

insert into public.empresa_modulo_health (
  empresa_id,
  modulo_codigo,
  status,
  configuration_complete,
  credentials_present,
  metadata
)
select
  e.id,
  m.codigo,
  case
    when coalesce(em.estado, 'inactivo') = 'activo' then 'unknown'
    else 'inactive'
  end,
  false,
  false,
  jsonb_build_object(
    'seeded_from', '0036_module_config_health_and_secret_refs',
    'module_name', m.nombre
  )
from public.empresas as e
cross join public.modulos as m
left join public.empresa_modulos as em
  on em.empresa_id = e.id
  and em.modulo_id = m.id
on conflict on constraint empresa_modulo_health_unique
do nothing;

create or replace function public.registrar_estado_salud_modulo(
  p_modulo_codigo text,
  p_status text,
  p_configuration_complete boolean default false,
  p_credentials_present boolean default false,
  p_last_error text default null,
  p_metadata jsonb default '{}'::jsonb
)
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
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_modulo_codigo text := nullif(btrim(coalesce(p_modulo_codigo, '')), '');
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_row public.empresa_modulo_health%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  if v_modulo_codigo is null or not exists (
    select 1 from public.modulos where codigo = v_modulo_codigo and estado = 'activo'
  ) then
    raise exception 'Modulo no encontrado.' using errcode = '02000';
  end if;

  if v_status not in ('unknown', 'healthy', 'misconfigured', 'unhealthy', 'inactive') then
    raise exception 'Estado de salud invalido.' using errcode = '22023';
  end if;

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
  values (
    v_empresa_id,
    v_modulo_codigo,
    v_status,
    coalesce(p_configuration_complete, false),
    coalesce(p_credentials_present, false),
    case when v_status = 'healthy' then now() else null end,
    case when v_status in ('misconfigured', 'unhealthy') then now() else null end,
    nullif(btrim(coalesce(p_last_error, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict on constraint empresa_modulo_health_unique
  do update set
    status = excluded.status,
    configuration_complete = excluded.configuration_complete,
    credentials_present = excluded.credentials_present,
    last_success_at = coalesce(excluded.last_success_at, public.empresa_modulo_health.last_success_at),
    last_error_at = coalesce(excluded.last_error_at, public.empresa_modulo_health.last_error_at),
    last_error = excluded.last_error,
    metadata = coalesce(public.empresa_modulo_health.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning * into v_row;

  return query
  select
    v_row.modulo_codigo,
    v_row.status,
    v_row.configuration_complete,
    v_row.credentials_present,
    v_row.last_success_at,
    v_row.last_error_at,
    v_row.last_error,
    v_row.metadata;
end;
$$;

revoke all on function public.registrar_estado_salud_modulo(text, text, boolean, boolean, text, jsonb) from public;
grant execute on function public.registrar_estado_salud_modulo(text, text, boolean, boolean, text, jsonb) to authenticated;

drop function if exists public.obtener_modulos_empresa_actual();

create or replace function public.obtener_modulos_empresa_actual()
returns table (
  modulo_id uuid,
  codigo text,
  nombre text,
  descripcion text,
  catalog_status text,
  company_status text,
  is_active boolean,
  fecha_activacion timestamptz,
  fecha_desactivacion timestamptz,
  health_status text,
  health_configuration_complete boolean,
  health_credentials_present boolean,
  health_last_success_at timestamptz,
  health_last_error_at timestamptz,
  health_last_error text,
  health_metadata jsonb
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

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  return query
  select
    m.id as modulo_id,
    m.codigo,
    m.nombre,
    m.descripcion,
    m.estado as catalog_status,
    em.estado as company_status,
    coalesce(em.estado = 'activo', false) as is_active,
    em.fecha_activacion,
    em.fecha_desactivacion,
    coalesce(h.status, case when coalesce(em.estado, 'inactivo') = 'activo' then 'unknown' else 'inactive' end) as health_status,
    coalesce(h.configuration_complete, false) as health_configuration_complete,
    coalesce(h.credentials_present, false) as health_credentials_present,
    h.last_success_at as health_last_success_at,
    h.last_error_at as health_last_error_at,
    h.last_error as health_last_error,
    coalesce(h.metadata, '{}'::jsonb) as health_metadata
  from public.modulos as m
  left join public.empresa_modulos as em
    on em.modulo_id = m.id
    and em.empresa_id = v_empresa_id
  left join public.empresa_modulo_health as h
    on h.empresa_id = v_empresa_id
    and h.modulo_codigo = m.codigo
  where m.estado = 'activo'
  order by m.orden asc, m.nombre asc;
end;
$$;

revoke all on function public.obtener_modulos_empresa_actual() from public;
grant execute on function public.obtener_modulos_empresa_actual() to authenticated;
