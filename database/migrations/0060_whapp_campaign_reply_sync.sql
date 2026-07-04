-- Whapp campaigns: attribute inbound customer replies back to campaign recipients.

create index if not exists inbox_campana_destinatarios_conversacion_estado_idx
  on public.inbox_campana_destinatarios (empresa_id, conversacion_id, estado)
  where conversacion_id is not null;

create or replace function public.sincronizar_inbox_campana_destinatario_respuesta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contact_phone text;
  v_contact_identifier text;
  v_destinatario_id uuid;
  v_campana_id uuid;
  v_reply_at timestamptz;
begin
  if new.empresa_id is null
    or new.conversacion_id is null
    or new.direccion <> 'entrante'
    or coalesce(new.es_nota_interna, false) then
    return new;
  end if;

  v_reply_at := coalesce(new.received_at, new.created_at, now());

  select
    nullif(regexp_replace(coalesce(c.contacto_telefono, ''), '[^0-9]', '', 'g'), ''),
    nullif(regexp_replace(coalesce(c.contacto_identificador, ''), '[^0-9]', '', 'g'), '')
  into v_contact_phone, v_contact_identifier
  from public.inbox_conversaciones as c
  where c.id = new.conversacion_id
    and c.empresa_id = new.empresa_id;

  if not found then
    return new;
  end if;

  select d.id, d.campana_id
  into v_destinatario_id, v_campana_id
  from public.inbox_campana_destinatarios as d
  join public.inbox_campanas as ca
    on ca.id = d.campana_id
   and ca.empresa_id = d.empresa_id
  join public.inbox_conversaciones as c
    on c.id = new.conversacion_id
   and c.empresa_id = new.empresa_id
  where d.empresa_id = new.empresa_id
    and ca.canal_id = c.canal_id
    and d.estado in ('enviado', 'entregado', 'leido')
    and d.replied_at is null
    and (
      d.conversacion_id = new.conversacion_id
      or nullif(regexp_replace(coalesce(d.telefono, ''), '[^0-9]', '', 'g'), '')
        in (v_contact_phone, v_contact_identifier)
    )
  order by
    case when d.conversacion_id = new.conversacion_id then 0 else 1 end,
    d.sent_at desc nulls last,
    d.updated_at desc,
    d.created_at desc
  limit 1;

  if v_destinatario_id is null then
    return new;
  end if;

  update public.inbox_campana_destinatarios as d
  set
    estado = 'respondido',
    replied_at = coalesce(d.replied_at, v_reply_at),
    conversacion_id = coalesce(d.conversacion_id, new.conversacion_id)
  where d.id = v_destinatario_id
    and d.empresa_id = new.empresa_id
    and d.estado in ('enviado', 'entregado', 'leido');

  perform public.recalcular_inbox_campana_metricas(new.empresa_id, v_campana_id);

  return new;
end;
$$;

drop trigger if exists sync_inbox_campaign_recipient_reply_from_message
on public.inbox_mensajes;

create trigger sync_inbox_campaign_recipient_reply_from_message
after insert on public.inbox_mensajes
for each row execute function public.sincronizar_inbox_campana_destinatario_respuesta();

revoke all on function public.sincronizar_inbox_campana_destinatario_respuesta() from public;
