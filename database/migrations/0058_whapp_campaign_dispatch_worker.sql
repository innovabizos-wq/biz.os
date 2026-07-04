-- Whapp campaigns: server-only dispatch config and audit fields for campaign worker.

alter table public.inbox_campana_destinatarios
  add column if not exists canal_message_id text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

create index if not exists inbox_campana_destinatarios_message_id_idx
  on public.inbox_campana_destinatarios (empresa_id, canal_message_id)
  where canal_message_id is not null;

create or replace function public.obtener_inbox_whatsapp_campaign_send_config_server(
  p_empresa_id uuid,
  p_canal_id uuid
)
returns table (
  canal_id uuid,
  empresa_id uuid,
  channel_name text,
  phone_number_id text,
  access_token text,
  access_token_updated_at timestamptz,
  access_token_suffix text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_access_token text;
  v_phone_number_id text;
begin
  if p_empresa_id is null or p_canal_id is null then
    raise exception 'Empresa y canal son obligatorios.' using errcode = '22023';
  end if;

  select *
  into v_canal
  from public.inbox_canales
  where id = p_canal_id
    and empresa_id = p_empresa_id
    and canal = 'whatsapp'
    and proveedor = 'meta'
    and estado = 'activo'
    and conexion_estado = 'configurado';

  if v_canal.id is null then
    raise exception 'Canal WhatsApp Meta activo/configurado no encontrado.' using errcode = '22023';
  end if;

  select *
  into v_secretos
  from public.inbox_canal_secretos
  where canal_id = p_canal_id
    and empresa_id = p_empresa_id;

  v_access_token := public.resolve_vault_or_inline_secret(
    v_secretos.access_token_secret_id,
    v_secretos.access_token
  );
  v_phone_number_id := nullif(btrim(v_canal.configuracion_publica->>'phone_number_id'), '');

  if v_access_token is null or nullif(btrim(v_access_token), '') is null then
    raise exception 'access_token no configurado.' using errcode = '22023';
  end if;

  if v_phone_number_id is null then
    raise exception 'phone_number_id no configurado.' using errcode = '22023';
  end if;

  return query
  select
    v_canal.id,
    v_canal.empresa_id,
    v_canal.nombre,
    v_phone_number_id,
    v_access_token,
    nullif(v_secretos.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(v_secretos.metadata_privada->>'access_token_suffix', '');
end;
$$;

revoke all on function public.obtener_inbox_whatsapp_campaign_send_config_server(uuid, uuid) from public;
revoke all on function public.obtener_inbox_whatsapp_campaign_send_config_server(uuid, uuid) from anon;
revoke all on function public.obtener_inbox_whatsapp_campaign_send_config_server(uuid, uuid) from authenticated;
grant execute on function public.obtener_inbox_whatsapp_campaign_send_config_server(uuid, uuid) to service_role;
