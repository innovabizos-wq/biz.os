-- Whapp campaigns: sync Meta status webhooks into campaign recipient tracking.

create or replace function public.recalcular_inbox_campana_metricas(
  p_empresa_id uuid,
  p_campana_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_count integer;
  v_sent_count integer;
  v_delivered_count integer;
  v_read_count integer;
  v_replied_count integer;
  v_failed_count integer;
  v_queued_count integer;
begin
  if p_empresa_id is null or p_campana_id is null then
    return;
  end if;

  select
    count(*) filter (where estado <> 'excluido'),
    count(*) filter (where estado in ('enviado', 'entregado', 'leido', 'respondido')),
    count(*) filter (where estado in ('entregado', 'leido', 'respondido')),
    count(*) filter (where estado in ('leido', 'respondido')),
    count(*) filter (where estado = 'respondido'),
    count(*) filter (where estado = 'fallido'),
    count(*) filter (where estado = 'en_cola')
  into
    v_recipient_count,
    v_sent_count,
    v_delivered_count,
    v_read_count,
    v_replied_count,
    v_failed_count,
    v_queued_count
  from public.inbox_campana_destinatarios
  where empresa_id = p_empresa_id
    and campana_id = p_campana_id;

  update public.inbox_campanas
  set
    recipient_count = coalesce(v_recipient_count, 0),
    sent_count = coalesce(v_sent_count, 0),
    delivered_count = coalesce(v_delivered_count, 0),
    read_count = coalesce(v_read_count, 0),
    replied_count = coalesce(v_replied_count, 0),
    failed_count = coalesce(v_failed_count, 0)
  where empresa_id = p_empresa_id
    and id = p_campana_id;

  if coalesce(v_queued_count, 0) = 0 then
    update public.inbox_campanas
    set estado = 'enviada'
    where empresa_id = p_empresa_id
      and id = p_campana_id
      and estado = 'enviando';
  end if;
end;
$$;

create or replace function public.sincronizar_inbox_campana_destinatario_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_estado text;
  v_status_at timestamptz;
  v_campana_id uuid;
begin
  if new.event_type <> 'status'
    or new.external_message_id is null
    or new.empresa_id is null then
    return new;
  end if;

  v_status := lower(coalesce(new.payload#>>'{status,status}', ''));
  v_estado := case v_status
    when 'sent' then 'enviado'
    when 'delivered' then 'entregado'
    when 'read' then 'leido'
    when 'failed' then 'fallido'
    else null
  end;

  if v_estado is null then
    return new;
  end if;

  v_status_at := case
    when nullif(new.payload#>>'{status,timestamp}', '') is not null
    then to_timestamp((new.payload#>>'{status,timestamp}')::double precision)
    else coalesce(new.processed_at, new.received_at, now())
  end;

  update public.inbox_campana_destinatarios as d
  set
    estado = case
      when d.estado = 'respondido' then d.estado
      when d.estado = 'leido' and v_estado in ('enviado', 'entregado') then d.estado
      when d.estado = 'entregado' and v_estado = 'enviado' then d.estado
      else v_estado
    end,
    sent_at = case
      when v_estado in ('enviado', 'entregado', 'leido') then coalesce(d.sent_at, v_status_at)
      else d.sent_at
    end,
    delivered_at = case
      when v_estado in ('entregado', 'leido') then coalesce(d.delivered_at, v_status_at)
      else d.delivered_at
    end,
    read_at = case
      when v_estado = 'leido' then coalesce(d.read_at, v_status_at)
      else d.read_at
    end,
    last_error = case
      when v_estado = 'fallido' then coalesce(new.payload#>>'{status,errors,0,message}', 'Meta reporto fallo de entrega.')
      else d.last_error
    end
  where d.empresa_id = new.empresa_id
    and d.canal_message_id = new.external_message_id
  returning d.campana_id into v_campana_id;

  if v_campana_id is not null then
    perform public.recalcular_inbox_campana_metricas(new.empresa_id, v_campana_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_inbox_campaign_recipient_status_from_webhook
on public.inbox_webhook_eventos;

create trigger sync_inbox_campaign_recipient_status_from_webhook
after insert on public.inbox_webhook_eventos
for each row execute function public.sincronizar_inbox_campana_destinatario_status();

revoke all on function public.recalcular_inbox_campana_metricas(uuid, uuid) from public;
revoke all on function public.sincronizar_inbox_campana_destinatario_status() from public;
