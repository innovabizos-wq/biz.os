-- biz.os official Meta channel configuration for Inbox.
-- Apply manually in Supabase SQL Editor after 0016_inbox_core.sql.
-- This phase stores configuration and secrets only. It does not receive webhooks
-- and does not send real messages.

alter table public.inbox_canales
  add column if not exists conexion_estado text not null default 'pendiente',
  add column if not exists proveedor_estado text,
  add column if not exists ultima_verificacion_at timestamptz,
  add column if not exists webhook_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inbox_canales_conexion_estado_check'
  ) then
    alter table public.inbox_canales
      add constraint inbox_canales_conexion_estado_check
      check (conexion_estado in ('pendiente', 'configurado', 'error', 'inactivo'));
  end if;
end;
$$;

create index if not exists inbox_canales_empresa_conexion_estado_idx
  on public.inbox_canales (empresa_id, conexion_estado);

create table if not exists public.inbox_canal_secretos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null,
  access_token text,
  app_secret text,
  verify_token text,
  token_expires_at timestamptz,
  metadata_privada jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inbox_canal_secretos_empresa_canal_unique unique (empresa_id, canal_id),
  constraint inbox_canal_secretos_canal_empresa_fkey
    foreign key (canal_id, empresa_id)
    references public.inbox_canales(id, empresa_id)
    on delete cascade,
  constraint inbox_canal_secretos_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint inbox_canal_secretos_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index if not exists inbox_canal_secretos_empresa_id_idx
  on public.inbox_canal_secretos (empresa_id);
create index if not exists inbox_canal_secretos_empresa_canal_idx
  on public.inbox_canal_secretos (empresa_id, canal_id);

drop trigger if exists set_inbox_canal_secretos_updated_at
on public.inbox_canal_secretos;

create trigger set_inbox_canal_secretos_updated_at
before update on public.inbox_canal_secretos
for each row execute function public.set_updated_at();

alter table public.inbox_canal_secretos enable row level security;

create or replace function public.crear_inbox_canal_meta(
  p_canal text,
  p_nombre text,
  p_identificador_externo text default null,
  p_phone_number_id text default null,
  p_waba_id text default null,
  p_page_id text default null,
  p_instagram_business_account_id text default null,
  p_business_id text default null,
  p_app_id text default null
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal public.inbox_canales%rowtype;
  v_config jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  if p_canal not in ('whatsapp', 'facebook', 'instagram') then
    raise exception 'Canal Meta invalido.' using errcode = '22023';
  end if;

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'Nombre de canal requerido.' using errcode = '22023';
  end if;

  v_config := jsonb_strip_nulls(jsonb_build_object(
    'phone_number_id', nullif(btrim(coalesce(p_phone_number_id, '')), ''),
    'waba_id', nullif(btrim(coalesce(p_waba_id, '')), ''),
    'page_id', nullif(btrim(coalesce(p_page_id, '')), ''),
    'instagram_business_account_id', nullif(btrim(coalesce(p_instagram_business_account_id, '')), ''),
    'business_id', nullif(btrim(coalesce(p_business_id, '')), ''),
    'app_id', nullif(btrim(coalesce(p_app_id, '')), '')
  ));

  insert into public.inbox_canales (
    empresa_id,
    canal,
    proveedor,
    nombre,
    identificador_externo,
    estado,
    conexion_estado,
    configuracion_publica,
    webhook_url,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal,
    'meta',
    btrim(p_nombre),
    nullif(btrim(coalesce(p_identificador_externo, '')), ''),
    'pendiente',
    'pendiente',
    v_config,
    '/api/webhooks/meta',
    v_user_id,
    v_user_id
  )
  returning * into v_canal;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canales',
    v_canal.id,
    'crear_inbox_canal_meta',
    to_jsonb(v_canal)
  );

  return next v_canal;
end;
$$;

create or replace function public.actualizar_inbox_canal_meta_config(
  p_canal_id uuid,
  p_nombre text,
  p_identificador_externo text default null,
  p_phone_number_id text default null,
  p_waba_id text default null,
  p_page_id text default null,
  p_instagram_business_account_id text default null,
  p_business_id text default null,
  p_app_id text default null,
  p_conexion_estado text default 'pendiente'
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_canales%rowtype;
  v_despues public.inbox_canales%rowtype;
  v_config jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'Nombre de canal requerido.' using errcode = '22023';
  end if;

  if p_conexion_estado not in ('pendiente', 'configurado', 'error', 'inactivo') then
    raise exception 'Estado de conexion invalido.' using errcode = '22023';
  end if;

  select c.* into v_antes
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_antes.proveedor <> 'meta' then
    raise exception 'El canal no es proveedor Meta.' using errcode = '22023';
  end if;

  v_config := jsonb_strip_nulls(jsonb_build_object(
    'phone_number_id', nullif(btrim(coalesce(p_phone_number_id, '')), ''),
    'waba_id', nullif(btrim(coalesce(p_waba_id, '')), ''),
    'page_id', nullif(btrim(coalesce(p_page_id, '')), ''),
    'instagram_business_account_id', nullif(btrim(coalesce(p_instagram_business_account_id, '')), ''),
    'business_id', nullif(btrim(coalesce(p_business_id, '')), ''),
    'app_id', nullif(btrim(coalesce(p_app_id, '')), '')
  ));

  update public.inbox_canales as c
  set nombre = btrim(p_nombre),
      identificador_externo = nullif(btrim(coalesce(p_identificador_externo, '')), ''),
      configuracion_publica = v_config,
      conexion_estado = p_conexion_estado,
      webhook_url = coalesce(c.webhook_url, '/api/webhooks/meta'),
      updated_by = v_user_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

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
    'inbox_canales',
    p_canal_id,
    'actualizar_inbox_canal_meta_config',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

create or replace function public.guardar_inbox_canal_meta_secretos(
  p_canal_id uuid,
  p_access_token text default null,
  p_app_secret text default null,
  p_verify_token text default null,
  p_token_expires_at timestamptz default null
)
returns table (
  canal_id uuid,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_canal.proveedor <> 'meta' then
    raise exception 'El canal no es proveedor Meta.' using errcode = '22023';
  end if;

  insert into public.inbox_canal_secretos (
    empresa_id,
    canal_id,
    access_token,
    app_secret,
    verify_token,
    token_expires_at,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    nullif(btrim(coalesce(p_access_token, '')), ''),
    nullif(btrim(coalesce(p_app_secret, '')), ''),
    nullif(btrim(coalesce(p_verify_token, '')), ''),
    p_token_expires_at,
    v_user_id,
    v_user_id
  )
  on conflict on constraint inbox_canal_secretos_empresa_canal_unique
  do update set
    access_token = coalesce(nullif(btrim(coalesce(p_access_token, '')), ''), public.inbox_canal_secretos.access_token),
    app_secret = coalesce(nullif(btrim(coalesce(p_app_secret, '')), ''), public.inbox_canal_secretos.app_secret),
    verify_token = coalesce(nullif(btrim(coalesce(p_verify_token, '')), ''), public.inbox_canal_secretos.verify_token),
    token_expires_at = coalesce(p_token_expires_at, public.inbox_canal_secretos.token_expires_at),
    updated_by = v_user_id
  returning * into v_secretos;

  update public.inbox_canales as c
  set conexion_estado = case
        when v_secretos.access_token is not null
          and v_secretos.app_secret is not null
          and v_secretos.verify_token is not null
        then 'configurado'
        else c.conexion_estado
      end,
      updated_by = v_user_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canal_secretos',
    v_secretos.id,
    'guardar_inbox_canal_meta_secretos',
    jsonb_build_object(
      'canal_id', p_canal_id,
      'tiene_access_token', v_secretos.access_token is not null,
      'tiene_app_secret', v_secretos.app_secret is not null,
      'tiene_verify_token', v_secretos.verify_token is not null
    )
  );

  return query
  select
    v_secretos.canal_id,
    v_secretos.access_token is not null,
    v_secretos.app_secret is not null,
    v_secretos.verify_token is not null,
    v_secretos.token_expires_at;
end;
$$;

create or replace function public.obtener_inbox_canal_meta_estado(
  p_canal_id uuid
)
returns table (
  canal_id uuid,
  proveedor text,
  canal text,
  conexion_estado text,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz,
  webhook_url text
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
    public.current_user_has_permission('inbox.channels.view')
    or public.current_user_has_permission('inbox.channels.manage')
  ) then
    raise exception 'Permiso inbox.channels.view requerido.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.proveedor,
    c.canal,
    c.conexion_estado,
    s.access_token is not null,
    s.app_secret is not null,
    s.verify_token is not null,
    s.token_expires_at,
    c.webhook_url
  from public.inbox_canales as c
  left join public.inbox_canal_secretos as s
    on s.canal_id = c.id
   and s.empresa_id = c.empresa_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;
end;
$$;

create or replace function public.regenerar_inbox_canal_verify_token(
  p_canal_id uuid
)
returns table (
  canal_id uuid,
  verify_token text,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_verify_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_canal.proveedor <> 'meta' then
    raise exception 'El canal no es proveedor Meta.' using errcode = '22023';
  end if;

  insert into public.inbox_canal_secretos (
    empresa_id,
    canal_id,
    verify_token,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    v_verify_token,
    v_user_id,
    v_user_id
  )
  on conflict on constraint inbox_canal_secretos_empresa_canal_unique
  do update set
    verify_token = v_verify_token,
    updated_by = v_user_id
  returning * into v_secretos;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canal_secretos',
    v_secretos.id,
    'regenerar_inbox_canal_verify_token',
    jsonb_build_object('canal_id', p_canal_id)
  );

  return query
  select
    v_secretos.canal_id,
    v_verify_token,
    v_secretos.access_token is not null,
    v_secretos.app_secret is not null,
    v_secretos.verify_token is not null,
    v_secretos.token_expires_at;
end;
$$;

create or replace function public.cambiar_estado_inbox_canal(
  p_canal_id uuid,
  p_estado text
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_canales%rowtype;
  v_despues public.inbox_canales%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  if p_estado not in ('activo', 'inactivo', 'pendiente', 'error') then
    raise exception 'Estado de canal invalido.' using errcode = '22023';
  end if;

  select c.* into v_antes
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  update public.inbox_canales as c
  set estado = p_estado,
      conexion_estado = case
        when p_estado = 'inactivo' then 'inactivo'
        when c.conexion_estado = 'inactivo' and p_estado <> 'inactivo' then 'pendiente'
        else c.conexion_estado
      end,
      updated_by = v_user_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

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
    'inbox_canales',
    p_canal_id,
    'cambiar_estado_inbox_canal',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

revoke all on function public.crear_inbox_canal_meta(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.actualizar_inbox_canal_meta_config(uuid, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) from public;
revoke all on function public.obtener_inbox_canal_meta_estado(uuid) from public;
revoke all on function public.regenerar_inbox_canal_verify_token(uuid) from public;
revoke all on function public.cambiar_estado_inbox_canal(uuid, text) from public;

grant execute on function public.crear_inbox_canal_meta(text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.actualizar_inbox_canal_meta_config(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.obtener_inbox_canal_meta_estado(uuid) to authenticated;
grant execute on function public.regenerar_inbox_canal_verify_token(uuid) to authenticated;
grant execute on function public.cambiar_estado_inbox_canal(uuid, text) to authenticated;
