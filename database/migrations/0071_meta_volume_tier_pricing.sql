alter table public.inbox_meta_tarifas
  add column if not exists volume_from bigint not null default 1,
  add column if not exists volume_to bigint,
  add column if not exists pricing_basis text not null default 'DELIVERED_MESSAGE';

alter table public.inbox_meta_tarifas
  drop constraint if exists inbox_meta_tarifas_unique;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inbox_meta_tarifas'::regclass
      and conname = 'inbox_meta_tarifas_volume_check'
  ) then
    alter table public.inbox_meta_tarifas
      add constraint inbox_meta_tarifas_volume_check
      check (volume_from >= 1 and (volume_to is null or volume_to >= volume_from));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inbox_meta_tarifas'::regclass
      and conname = 'inbox_meta_tarifas_non_tier_category_check'
  ) then
    alter table public.inbox_meta_tarifas
      add constraint inbox_meta_tarifas_non_tier_category_check
      check (
        categoria in ('AUTHENTICATION', 'AUTHENTICATION_INTERNATIONAL', 'UTILITY')
        or (volume_from = 1 and volume_to is null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inbox_meta_tarifas'::regclass
      and conname = 'inbox_meta_tarifas_tier_unique'
  ) then
    alter table public.inbox_meta_tarifas
      add constraint inbox_meta_tarifas_tier_unique
      unique (market_code, categoria, currency, effective_from, volume_from);
  end if;
end;
$$;

create index if not exists inbox_meta_tarifas_lookup_idx
  on public.inbox_meta_tarifas (
    market_code, categoria, effective_from desc, volume_from desc
  );

alter table public.inbox_meta_costos_mensajes
  add column if not exists rate_id uuid references public.inbox_meta_tarifas(id) on delete set null,
  add column if not exists volume_position bigint,
  add column if not exists rate_source_url text;

create or replace function public.sincronizar_inbox_meta_costo_desde_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_billable boolean;
  v_free_entry_point boolean;
  v_categoria text;
  v_model text;
  v_mensaje_id uuid;
  v_destinatario_id uuid;
  v_campana_id uuid;
  v_market_code text;
  v_rate_id uuid;
  v_currency text;
  v_unit_cost numeric(14, 6);
  v_rate_source_url text;
  v_amount numeric(14, 6);
  v_volume_position bigint;
  v_contact_phone text;
  v_delivered_at timestamptz;
  v_pricing_at timestamptz;
begin
  if new.event_type <> 'status' or new.external_message_id is null or new.empresa_id is null then
    return new;
  end if;

  if new.payload#>'{status,pricing}' is null then
    return new;
  end if;

  v_billable := lower(coalesce(new.payload#>>'{status,pricing,billable}', '')) = 'true';
  v_free_entry_point := lower(coalesce(new.payload#>>'{status,pricing,free_entry_point}', '')) = 'true';
  v_categoria := upper(nullif(new.payload#>>'{status,pricing,category}', ''));
  v_model := nullif(new.payload#>>'{status,pricing,pricing_model}', '');
  v_delivered_at := case
    when new.payload#>>'{status,status}' in ('delivered', 'read')
      and nullif(new.payload#>>'{status,timestamp}', '') is not null
    then to_timestamp((new.payload#>>'{status,timestamp}')::double precision)
    else null
  end;
  v_pricing_at := coalesce(v_delivered_at, now());

  select id into v_mensaje_id
  from public.inbox_mensajes
  where empresa_id = new.empresa_id and canal_message_id = new.external_message_id
  order by created_at desc limit 1;

  select id, campana_id, market_code
    into v_destinatario_id, v_campana_id, v_market_code
  from public.inbox_campana_destinatarios
  where empresa_id = new.empresa_id and canal_message_id = new.external_message_id
  order by created_at desc limit 1;

  if v_market_code is null and v_mensaje_id is not null then
    select regexp_replace(
      coalesce(c.contacto_telefono, c.contacto_identificador, c.contacto_usuario, ''),
      '[^0-9]', '', 'g'
    ) into v_contact_phone
    from public.inbox_mensajes as m
    join public.inbox_conversaciones as c
      on c.id = m.conversacion_id and c.empresa_id = m.empresa_id
    where m.id = v_mensaje_id;

    select market_code into v_market_code
    from (values
      ('971', 'UNITED_ARAB_EMIRATES'), ('966', 'SAUDI_ARABIA'), ('974', 'QATAR'),
      ('972', 'ISRAEL'), ('852', 'HONG_KONG'), ('234', 'NIGERIA'),
      ('506', 'REST_OF_LATIN_AMERICA'), ('507', 'REST_OF_LATIN_AMERICA'),
      ('505', 'REST_OF_LATIN_AMERICA'), ('504', 'REST_OF_LATIN_AMERICA'),
      ('503', 'REST_OF_LATIN_AMERICA'), ('502', 'REST_OF_LATIN_AMERICA'),
      ('501', 'REST_OF_LATIN_AMERICA'), ('598', 'REST_OF_LATIN_AMERICA'),
      ('595', 'REST_OF_LATIN_AMERICA'), ('593', 'REST_OF_LATIN_AMERICA'),
      ('591', 'REST_OF_LATIN_AMERICA'), ('92', 'PAKISTAN'), ('91', 'INDIA'),
      ('90', 'TURKEY'), ('65', 'SINGAPORE'), ('62', 'INDONESIA'),
      ('60', 'MALAYSIA'), ('58', 'REST_OF_LATIN_AMERICA'), ('57', 'COLOMBIA'),
      ('56', 'CHILE'), ('55', 'BRAZIL'), ('54', 'ARGENTINA'), ('52', 'MEXICO'),
      ('51', 'PERU'), ('49', 'GERMANY'), ('48', 'POLAND'), ('44', 'UNITED_KINGDOM'),
      ('40', 'ROMANIA'), ('39', 'ITALY'), ('36', 'HUNGARY'), ('34', 'SPAIN'),
      ('33', 'FRANCE'), ('31', 'NETHERLANDS'), ('27', 'SOUTH_AFRICA'),
      ('20', 'EGYPT'), ('7', 'RUSSIA'), ('1', 'NORTH_AMERICA')
    ) as markets(prefix, market_code)
    where v_contact_phone like prefix || '%'
    order by length(prefix) desc
    limit 1;
    v_market_code := coalesce(v_market_code, 'OTHER');
  end if;

  if v_billable and v_market_code is not null and v_categoria is not null then
    select count(*) + 1 into v_volume_position
    from public.inbox_meta_costos_mensajes
    where empresa_id = new.empresa_id
      and market_code = upper(v_market_code)
      and categoria = v_categoria
      and billable is true
      and external_message_id is distinct from new.external_message_id
      and coalesce(delivered_at, created_at) >= date_trunc('month', v_pricing_at)
      and coalesce(delivered_at, created_at) < date_trunc('month', v_pricing_at) + interval '1 month';

    select id, currency, unit_cost, source_url
      into v_rate_id, v_currency, v_unit_cost, v_rate_source_url
    from public.inbox_meta_tarifas
    where market_code = upper(v_market_code)
      and categoria = v_categoria
      and effective_from <= v_pricing_at::date
      and (effective_to is null or effective_to >= v_pricing_at::date)
      and volume_from <= v_volume_position
      and (volume_to is null or volume_to >= v_volume_position)
    order by effective_from desc, volume_from desc
    limit 1;
    v_amount := v_unit_cost;
  end if;

  insert into public.inbox_meta_costos_mensajes (
    empresa_id, canal_id, mensaje_id, destinatario_campana_id,
    external_message_id, categoria, pricing_model, market_code, billable,
    free_entry_point, rate_id, volume_position, rate_source_url,
    currency, unit_cost, amount, estado, pricing_payload, delivered_at
  ) values (
    new.empresa_id, new.canal_id, v_mensaje_id, v_destinatario_id,
    new.external_message_id, v_categoria, v_model, upper(v_market_code), v_billable,
    v_free_entry_point, v_rate_id, v_volume_position, v_rate_source_url,
    v_currency, v_unit_cost, v_amount,
    case when not v_billable then 'no_facturable' when v_amount is not null then 'estimado' else 'pendiente_tarifa' end,
    coalesce(new.payload#>'{status,pricing}', '{}'::jsonb), v_delivered_at
  )
  on conflict (empresa_id, external_message_id) where external_message_id is not null
  do update set
    categoria = coalesce(excluded.categoria, public.inbox_meta_costos_mensajes.categoria),
    pricing_model = coalesce(excluded.pricing_model, public.inbox_meta_costos_mensajes.pricing_model),
    market_code = coalesce(excluded.market_code, public.inbox_meta_costos_mensajes.market_code),
    billable = excluded.billable,
    free_entry_point = excluded.free_entry_point,
    rate_id = coalesce(excluded.rate_id, public.inbox_meta_costos_mensajes.rate_id),
    volume_position = coalesce(excluded.volume_position, public.inbox_meta_costos_mensajes.volume_position),
    rate_source_url = coalesce(excluded.rate_source_url, public.inbox_meta_costos_mensajes.rate_source_url),
    currency = coalesce(excluded.currency, public.inbox_meta_costos_mensajes.currency),
    unit_cost = coalesce(excluded.unit_cost, public.inbox_meta_costos_mensajes.unit_cost),
    amount = coalesce(excluded.amount, public.inbox_meta_costos_mensajes.amount),
    estado = excluded.estado,
    pricing_payload = excluded.pricing_payload,
    delivered_at = coalesce(excluded.delivered_at, public.inbox_meta_costos_mensajes.delivered_at),
    updated_at = now();

  update public.inbox_campana_destinatarios
  set pricing_category = coalesce(v_categoria, pricing_category),
      pricing_model = coalesce(v_model, pricing_model),
      currency = coalesce(v_currency, currency),
      unit_cost = coalesce(v_unit_cost, unit_cost),
      actual_cost = coalesce(v_amount, actual_cost),
      billable = v_billable,
      billing_status = case when not v_billable then 'no_facturable' when v_amount is not null then 'estimado' else 'pendiente_tarifa' end
  where id = v_destinatario_id;

  if v_campana_id is not null then
    update public.inbox_campanas as c
    set actual_cost = coalesce((
          select sum(coalesce(d.actual_cost, 0))
          from public.inbox_campana_destinatarios as d
          where d.campana_id = v_campana_id and d.empresa_id = new.empresa_id
        ), 0),
        cost_currency = coalesce(v_currency, c.cost_currency),
        billing_status = case
          when exists (
            select 1 from public.inbox_campana_destinatarios as d
            where d.campana_id = v_campana_id and d.billing_status = 'pendiente_tarifa'
          ) then 'pendiente_tarifa'
          else 'estimado'
        end
    where c.id = v_campana_id and c.empresa_id = new.empresa_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sincronizar_inbox_meta_costo_desde_status() from public;
