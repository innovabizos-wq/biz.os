-- Real outbound messaging for WhatsApp, Facebook Messenger and Instagram.
-- Secrets remain server-only and are resolved from Vault by a SECURITY DEFINER RPC.

create or replace function public.obtener_inbox_meta_send_config_server(
  p_conversacion_id uuid,
  p_empresa_id uuid,
  p_actor_id uuid
)
returns table (
  conversacion_id uuid,
  empresa_id uuid,
  canal_id uuid,
  channel_name text,
  channel_type text,
  account_id text,
  recipient_id text,
  access_token text,
  access_token_updated_at timestamptz,
  access_token_suffix text,
  api_host text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.inbox_conversaciones%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_access_token text;
  v_account_id text;
  v_recipient_id text;
  v_api_host text;
  v_token_expires_at timestamptz;
begin
  if not public.profile_has_permission(
    p_actor_id,
    p_empresa_id,
    'inbox.conversations.reply'
  ) then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  select * into v_conversacion
  from public.inbox_conversaciones
  where id = p_conversacion_id
    and empresa_id = p_empresa_id;

  if v_conversacion.id is null or v_conversacion.canal_id is null then
    raise exception 'Conversacion Meta no encontrada.' using errcode = 'P0002';
  end if;

  select * into v_canal
  from public.inbox_canales
  where id = v_conversacion.canal_id
    and empresa_id = p_empresa_id;

  if v_canal.id is null
    or v_canal.proveedor <> 'meta'
    or v_canal.canal not in ('whatsapp', 'facebook', 'instagram')
    or v_canal.canal <> v_conversacion.canal
    or v_canal.estado <> 'activo'
    or v_canal.conexion_estado <> 'configurado' then
    raise exception 'Canal Meta no configurado.' using errcode = '22023';
  end if;

  select * into v_secretos
  from public.inbox_canal_secretos
  where canal_id = v_canal.id
    and empresa_id = p_empresa_id;

  v_access_token := public.resolve_vault_or_inline_secret(
    v_secretos.access_token_secret_id,
    v_secretos.access_token
  );
  v_token_expires_at := v_secretos.token_expires_at;

  v_account_id := case v_canal.canal
    when 'whatsapp' then nullif(btrim(v_canal.configuracion_publica->>'phone_number_id'), '')
    when 'facebook' then nullif(btrim(v_canal.configuracion_publica->>'page_id'), '')
    when 'instagram' then nullif(btrim(v_canal.configuracion_publica->>'instagram_business_account_id'), '')
  end;

  v_recipient_id := case v_canal.canal
    when 'whatsapp' then regexp_replace(
      coalesce(
        nullif(v_conversacion.contacto_telefono, ''),
        nullif(v_conversacion.contacto_identificador, ''),
        nullif(v_conversacion.contacto_usuario, '')
      ),
      '[^0-9]',
      '',
      'g'
    )
    else nullif(btrim(coalesce(
      nullif(v_conversacion.contacto_identificador, ''),
      nullif(v_conversacion.contacto_usuario, '')
    )), '')
  end;

  v_api_host := case
    when v_canal.canal = 'instagram'
      and lower(v_canal.configuracion_publica->>'instagram_api_host') = 'graph.instagram.com'
    then 'graph.instagram.com'
    else 'graph.facebook.com'
  end;

  if v_access_token is null or nullif(btrim(v_access_token), '') is null then
    raise exception 'access_token de Meta no configurado.' using errcode = '22023';
  end if;

  if v_token_expires_at is not null and v_token_expires_at <= now() then
    raise exception 'access_token de Meta vencido.' using errcode = '22023';
  end if;

  if v_account_id is null then
    raise exception 'Identificador de cuenta Meta no configurado.' using errcode = '22023';
  end if;

  if v_recipient_id is null
    or (v_canal.canal = 'whatsapp' and length(v_recipient_id) < 8) then
    raise exception 'Destinatario Meta invalido.' using errcode = '22023';
  end if;

  return query
  select
    v_conversacion.id,
    p_empresa_id,
    v_canal.id,
    v_canal.nombre,
    v_canal.canal,
    v_account_id,
    v_recipient_id,
    v_access_token,
    nullif(v_secretos.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(v_secretos.metadata_privada->>'access_token_suffix', ''),
    v_api_host;
end;
$$;

revoke all on function public.obtener_inbox_meta_send_config_server(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.obtener_inbox_meta_send_config_server(uuid, uuid, uuid)
  to service_role;

create or replace function public.registrar_inbox_mensaje_saliente_meta(
  p_conversacion_id uuid,
  p_contenido text,
  p_canal_message_id text default null,
  p_estado text default 'enviado',
  p_error text default null
)
returns setof public.inbox_mensajes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_mensaje public.inbox_mensajes%rowtype;
  v_estado text := coalesce(nullif(btrim(p_estado), ''), 'enviado');
  v_contenido text := nullif(btrim(coalesce(p_contenido, '')), '');
  v_channel_label text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  if v_estado not in ('enviado', 'fallido') then
    raise exception 'Estado de mensaje invalido.' using errcode = '22023';
  end if;

  if v_contenido is null then
    raise exception 'Contenido de mensaje requerido.' using errcode = '22023';
  end if;

  select c.* into v_conversacion
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_conversacion.id is null or v_conversacion.canal_id is null then
    raise exception 'Conversacion no encontrada.' using errcode = 'P0002';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = v_conversacion.canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null
    or v_canal.proveedor <> 'meta'
    or v_canal.canal not in ('whatsapp', 'facebook', 'instagram') then
    raise exception 'La conversacion no pertenece a un canal Meta.' using errcode = '22023';
  end if;

  v_channel_label := case v_canal.canal
    when 'whatsapp' then 'WhatsApp'
    when 'facebook' then 'Facebook Messenger'
    when 'instagram' then 'Instagram'
  end;

  insert into public.inbox_mensajes (
    empresa_id,
    conversacion_id,
    direccion,
    tipo,
    contenido,
    estado,
    canal_message_id,
    es_nota_interna,
    enviado_por,
    sent_at
  )
  values (
    v_empresa_id,
    v_conversacion.id,
    'saliente',
    'texto',
    v_contenido,
    v_estado,
    nullif(btrim(coalesce(p_canal_message_id, '')), ''),
    false,
    v_user_id,
    now()
  )
  returning * into v_mensaje;

  update public.inbox_conversaciones as ic
  set ultimo_mensaje = v_contenido,
      ultimo_mensaje_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where ic.id = v_conversacion.id
    and ic.empresa_id = v_empresa_id;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    v_conversacion.id,
    'mensaje_saliente_meta',
    case
      when v_estado = 'enviado'
        then format('Mensaje saliente enviado por %s.', v_channel_label)
      else format('Intento de mensaje saliente por %s fallido.', v_channel_label)
    end,
    jsonb_build_object(
      'canal', v_canal.canal,
      'message_id', nullif(btrim(coalesce(p_canal_message_id, '')), ''),
      'estado', v_estado,
      'error', nullif(btrim(coalesce(p_error, '')), '')
    ),
    v_user_id
  );

  return next v_mensaje;
end;
$$;

revoke all on function public.registrar_inbox_mensaje_saliente_meta(uuid, text, text, text, text)
  from public;
grant execute on function public.registrar_inbox_mensaje_saliente_meta(uuid, text, text, text, text)
  to authenticated;

-- Supabase's 2026 Data API grant hardening no longer implicitly exposes tables.
-- The campaign dispatcher uses only these operations with a server-held service key.
grant select, update on table public.inbox_campana_destinatarios to service_role;
grant select, update on table public.inbox_campanas to service_role;
grant select on table public.inbox_meta_plantillas to service_role;
