-- biz.os Whapp core hardening.
-- Apply manually in Supabase SQL Editor after 0022_inbox_meta_reliability_send.sql.
-- This migration does not delete data, does not send messages, and does not bypass RLS for UI reads.

create or replace function public.normalize_phone_digits(
  p_value text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g'), '');
$$;

create or replace function public.whapp_try_link_conversation_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_customer_id uuid;
begin
  if new.cliente_id is not null then
    return new;
  end if;

  v_phone := coalesce(
    public.normalize_phone_digits(new.contacto_telefono),
    public.normalize_phone_digits(new.contacto_identificador),
    public.normalize_phone_digits(new.contacto_usuario)
  );

  if v_phone is null then
    return new;
  end if;

  select c.id into v_customer_id
  from public.crm_clientes as c
  where c.empresa_id = new.empresa_id
    and (
      public.normalize_phone_digits(c.whatsapp) = v_phone
      or public.normalize_phone_digits(c.telefono) = v_phone
    )
  order by c.updated_at desc
  limit 1;

  if v_customer_id is null then
    return new;
  end if;

  update public.inbox_conversaciones as ic
  set cliente_id = v_customer_id,
      updated_at = now()
  where ic.id = new.id
    and ic.empresa_id = new.empresa_id
    and ic.cliente_id is null;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata
  )
  values (
    new.empresa_id,
    new.id,
    'cliente_vinculado_auto',
    'Cliente CRM vinculado automaticamente por telefono/WhatsApp.',
    jsonb_build_object('cliente_id', v_customer_id, 'phone_digits', v_phone)
  );

  return new;
end;
$$;

drop trigger if exists whapp_try_link_conversation_customer_trigger
on public.inbox_conversaciones;

create trigger whapp_try_link_conversation_customer_trigger
after insert on public.inbox_conversaciones
for each row execute function public.whapp_try_link_conversation_customer();

create or replace function public.whapp_apply_message_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_message public.inbox_mensajes%rowtype;
begin
  if new.proveedor <> 'meta'
    or new.event_type <> 'status'
    or new.external_message_id is null
    or new.empresa_id is null then
    return new;
  end if;

  v_status := case lower(coalesce(new.payload#>>'{status,status}', ''))
    when 'sent' then 'enviado'
    when 'delivered' then 'entregado'
    when 'read' then 'leido'
    when 'failed' then 'fallido'
    else null
  end;

  if v_status is null then
    return new;
  end if;

  update public.inbox_mensajes as im
  set estado = v_status
  where im.empresa_id = new.empresa_id
    and im.canal_message_id = new.external_message_id
    and im.direccion = 'saliente'
  returning im.* into v_message;

  if v_message.id is null then
    return new;
  end if;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata
  )
  values (
    new.empresa_id,
    v_message.conversacion_id,
    'estado_mensaje_meta',
    'Estado de mensaje WhatsApp actualizado desde webhook Meta.',
    jsonb_build_object(
      'message_id', new.external_message_id,
      'estado', v_status,
      'webhook_evento_id', new.id
    )
  );

  return new;
end;
$$;

drop trigger if exists whapp_apply_message_status_event_trigger
on public.inbox_webhook_eventos;

create trigger whapp_apply_message_status_event_trigger
after insert on public.inbox_webhook_eventos
for each row execute function public.whapp_apply_message_status_event();

revoke all on function public.normalize_phone_digits(text) from public;
revoke all on function public.whapp_try_link_conversation_customer() from public;
revoke all on function public.whapp_apply_message_status_event() from public;

grant execute on function public.normalize_phone_digits(text) to authenticated;
