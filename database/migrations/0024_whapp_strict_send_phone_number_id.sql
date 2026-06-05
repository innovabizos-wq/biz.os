-- biz.os Whapp strict outbound WhatsApp send config.
-- Apply manually in Supabase SQL Editor after 0023_whapp_core_status_crm_link.sql.
-- This migration does not send messages and does not modify channel/conversation data.

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
  access_token text
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
    v_secretos.access_token;
end;
$$;

revoke all on function public.obtener_inbox_whatsapp_send_config(uuid) from public;
grant execute on function public.obtener_inbox_whatsapp_send_config(uuid) to authenticated;
