-- biz.os Whapp access token diagnostics.
-- Apply manually in Supabase SQL Editor after 0024_whapp_strict_send_phone_number_id.sql.
-- This migration does not expose full secrets and does not send messages.

drop function if exists public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz);

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
  v_access_token text := nullif(btrim(coalesce(p_access_token, '')), '');
  v_app_secret text := nullif(btrim(coalesce(p_app_secret, '')), '');
  v_verify_token text := nullif(btrim(coalesce(p_verify_token, '')), '');
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
    metadata_privada,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    v_access_token,
    v_app_secret,
    v_verify_token,
    p_token_expires_at,
    jsonb_strip_nulls(jsonb_build_object(
      'access_token_updated_at', case when v_access_token is not null then now() else null end,
      'access_token_suffix', case when v_access_token is not null then right(v_access_token, 6) else null end
    )),
    v_user_id,
    v_user_id
  )
  on conflict on constraint inbox_canal_secretos_empresa_canal_unique
  do update set
    access_token = coalesce(v_access_token, public.inbox_canal_secretos.access_token),
    app_secret = coalesce(v_app_secret, public.inbox_canal_secretos.app_secret),
    verify_token = coalesce(v_verify_token, public.inbox_canal_secretos.verify_token),
    token_expires_at = coalesce(p_token_expires_at, public.inbox_canal_secretos.token_expires_at),
    metadata_privada = case
      when v_access_token is not null then
        coalesce(public.inbox_canal_secretos.metadata_privada, '{}'::jsonb)
        || jsonb_build_object(
          'access_token_updated_at', now(),
          'access_token_suffix', right(v_access_token, 6)
        )
      else public.inbox_canal_secretos.metadata_privada
    end,
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
      'tiene_verify_token', v_secretos.verify_token is not null,
      'access_token_updated', v_access_token is not null,
      'access_token_suffix', v_secretos.metadata_privada->>'access_token_suffix'
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

drop function if exists public.obtener_inbox_canal_meta_estado(uuid);

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
  webhook_url text,
  access_token_updated_at timestamptz,
  access_token_suffix text
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
    c.webhook_url,
    nullif(s.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(s.metadata_privada->>'access_token_suffix', '')
  from public.inbox_canales as c
  left join public.inbox_canal_secretos as s
    on s.canal_id = c.id
   and s.empresa_id = c.empresa_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;
end;
$$;

drop function if exists public.obtener_inbox_whatsapp_send_config(uuid);

create or replace function public.obtener_inbox_whatsapp_send_config(
  p_conversacion_id uuid
)
returns table (
  conversacion_id uuid,
  empresa_id uuid,
  canal_id uuid,
  channel_name text,
  phone_number_id text,
  to_phone text,
  access_token text,
  access_token_updated_at timestamptz,
  access_token_suffix text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_phone_number_id text;
  v_to_phone text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  select c.* into v_conversacion
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_conversacion.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = 'P0002';
  end if;

  if v_conversacion.canal_id is null then
    raise exception 'La conversacion no tiene canal WhatsApp asociado.' using errcode = '22023';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = v_conversacion.canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal asociado no encontrado.' using errcode = 'P0002';
  end if;

  if v_canal.proveedor <> 'meta' or v_canal.canal <> 'whatsapp' then
    raise exception 'El canal asociado no es WhatsApp Meta.' using errcode = '22023';
  end if;

  if v_canal.estado = 'inactivo' then
    raise exception 'El canal asociado esta inactivo.' using errcode = '22023';
  end if;

  if v_canal.estado <> 'activo' then
    raise exception 'El canal asociado no esta activo.' using errcode = '22023';
  end if;

  if v_canal.conexion_estado <> 'configurado' then
    raise exception 'El canal asociado no esta configurado.' using errcode = '22023';
  end if;

  select s.* into v_secretos
  from public.inbox_canal_secretos as s
  where s.canal_id = v_canal.id
    and s.empresa_id = v_empresa_id;

  v_phone_number_id := nullif(btrim(v_canal.configuracion_publica->>'phone_number_id'), '');
  v_to_phone := regexp_replace(
    coalesce(
      nullif(v_conversacion.contacto_telefono, ''),
      nullif(v_conversacion.contacto_identificador, ''),
      nullif(v_conversacion.contacto_usuario, '')
    ),
    '[^0-9]',
    '',
    'g'
  );

  if v_phone_number_id is null then
    raise exception 'phone_number_id no configurado en configuracion_publica del canal asociado.' using errcode = '22023';
  end if;

  if v_secretos.access_token is null or nullif(btrim(v_secretos.access_token), '') is null then
    raise exception 'access_token no configurado.' using errcode = '22023';
  end if;

  if v_to_phone is null or length(v_to_phone) < 8 then
    raise exception 'Destinatario WhatsApp invalido.' using errcode = '22023';
  end if;

  return query
  select
    v_conversacion.id,
    v_empresa_id,
    v_canal.id,
    v_canal.nombre,
    v_phone_number_id,
    v_to_phone,
    v_secretos.access_token,
    nullif(v_secretos.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(v_secretos.metadata_privada->>'access_token_suffix', '');
end;
$$;

revoke all on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) from public;
revoke all on function public.obtener_inbox_canal_meta_estado(uuid) from public;
revoke all on function public.obtener_inbox_whatsapp_send_config(uuid) from public;

grant execute on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.obtener_inbox_canal_meta_estado(uuid) to authenticated;
grant execute on function public.obtener_inbox_whatsapp_send_config(uuid) to authenticated;
