-- Meta WhatsApp pricing effective October 1, 2026.
-- Billability remains authoritative from the webhook pricing payload. This is
-- especially important for phone numbers shared between multiple PMAs.

update public.inbox_meta_tarifas
set effective_to = date '2026-09-30'
where effective_from < date '2026-10-01'
  and (effective_to is null or effective_to >= date '2026-10-01')
  and (
    (market_code in ('REST_OF_LATIN_AMERICA', 'MEXICO') and categoria = 'SERVICE')
    or (market_code = 'MEXICO' and categoria = 'MARKETING')
  );

insert into public.inbox_meta_tarifas (
  market_code,
  categoria,
  currency,
  unit_cost,
  effective_from,
  effective_to,
  source_url,
  volume_from,
  volume_to,
  pricing_basis
)
values
  (
    'REST_OF_LATIN_AMERICA',
    'SERVICE',
    'USD',
    0.0113,
    date '2026-10-01',
    null,
    'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing',
    1,
    null,
    'DELIVERED_MESSAGE'
  ),
  (
    'MEXICO',
    'SERVICE',
    'USD',
    0.0085,
    date '2026-10-01',
    null,
    'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing',
    1,
    null,
    'DELIVERED_MESSAGE'
  ),
  (
    'MEXICO',
    'MARKETING',
    'USD',
    0.0397,
    date '2026-10-01',
    null,
    'https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing',
    1,
    null,
    'DELIVERED_MESSAGE'
  )
on conflict (market_code, categoria, currency, effective_from, volume_from)
do update set
  unit_cost = excluded.unit_cost,
  effective_to = excluded.effective_to,
  source_url = excluded.source_url,
  volume_to = excluded.volume_to,
  pricing_basis = excluded.pricing_basis;

-- Repair estimates created after the new prices took effect. Messages marked
-- non-billable by Meta (including the monthly service allowance and FEP) stay
-- untouched, as do already reconciled financial records.
update public.inbox_meta_costos_mensajes as cost
set rate_id = rate.id,
    rate_source_url = rate.source_url,
    currency = rate.currency,
    unit_cost = rate.unit_cost,
    amount = rate.unit_cost,
    estado = 'estimado',
    updated_at = now()
from public.inbox_meta_tarifas as rate
where cost.billable is true
  and cost.free_entry_point is false
  and cost.estado <> 'conciliado'
  and coalesce(cost.delivered_at, cost.created_at)::date >= date '2026-10-01'
  and rate.market_code = cost.market_code
  and rate.categoria = cost.categoria
  and rate.currency = 'USD'
  and rate.effective_from = date '2026-10-01'
  and rate.volume_from <= coalesce(cost.volume_position, 1)
  and (rate.volume_to is null or rate.volume_to >= coalesce(cost.volume_position, 1))
  and (
    (cost.market_code = 'REST_OF_LATIN_AMERICA' and cost.categoria = 'SERVICE')
    or (cost.market_code = 'MEXICO' and cost.categoria in ('SERVICE', 'MARKETING'))
  );

update public.inbox_campana_destinatarios as recipient
set currency = cost.currency,
    unit_cost = cost.unit_cost,
    actual_cost = cost.amount,
    billable = cost.billable,
    billing_status = cost.estado
from public.inbox_meta_costos_mensajes as cost
where cost.destinatario_campana_id = recipient.id
  and cost.billable is true
  and cost.free_entry_point is false
  and cost.estado = 'estimado'
  and coalesce(cost.delivered_at, cost.created_at)::date >= date '2026-10-01'
  and (
    (cost.market_code = 'REST_OF_LATIN_AMERICA' and cost.categoria = 'SERVICE')
    or (cost.market_code = 'MEXICO' and cost.categoria in ('SERVICE', 'MARKETING'))
  );

update public.inbox_campanas as campaign
set actual_cost = coalesce((
      select sum(coalesce(recipient.actual_cost, 0))
      from public.inbox_campana_destinatarios as recipient
      where recipient.campana_id = campaign.id
        and recipient.empresa_id = campaign.empresa_id
    ), 0),
    cost_currency = 'USD',
    billing_status = case
      when exists (
        select 1
        from public.inbox_campana_destinatarios as recipient
        where recipient.campana_id = campaign.id
          and recipient.empresa_id = campaign.empresa_id
          and recipient.billing_status = 'pendiente_tarifa'
      ) then 'pendiente_tarifa'
      else 'estimado'
    end
where exists (
  select 1
  from public.inbox_campana_destinatarios as recipient
  join public.inbox_meta_costos_mensajes as cost
    on cost.destinatario_campana_id = recipient.id
  where recipient.campana_id = campaign.id
    and recipient.empresa_id = campaign.empresa_id
    and cost.billable is true
    and cost.free_entry_point is false
    and cost.estado = 'estimado'
    and coalesce(cost.delivered_at, cost.created_at)::date >= date '2026-10-01'
    and (
      (cost.market_code = 'REST_OF_LATIN_AMERICA' and cost.categoria = 'SERVICE')
      or (cost.market_code = 'MEXICO' and cost.categoria in ('SERVICE', 'MARKETING'))
    )
);
