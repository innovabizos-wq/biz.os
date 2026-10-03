-- WhatsApp Account Model Evolution (WAAC/PMA).
-- A WhatsApp phone number can now be shared by multiple official partners.
-- biz.os keeps the identifiers for its own Messaging Account (PMA), records
-- cost attribution, and can disable its automations when another partner owns them.

alter table public.inbox_meta_costos_mensajes
  add column if not exists waac_id text,
  add column if not exists pma_id text,
  add column if not exists external_partner text,
  add column if not exists billing_account_kind text not null default 'legacy_waba';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'inbox_meta_costos_mensajes_billing_account_kind_check'
  ) then
    alter table public.inbox_meta_costos_mensajes
      add constraint inbox_meta_costos_mensajes_billing_account_kind_check
      check (billing_account_kind in ('legacy_waba', 'pma'));
  end if;
end;
$$;

create index if not exists inbox_meta_costos_mensajes_pma_idx
  on public.inbox_meta_costos_mensajes (empresa_id, pma_id, created_at desc)
  where pma_id is not null;

-- Assign the Account Model identifiers to every cost record as it is created.
create or replace function public.asignar_inbox_meta_costo_cuenta_mensajeria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config jsonb;
begin
  if new.canal_id is null then
    return new;
  end if;

  select configuracion_publica into v_config
  from public.inbox_canales
  where id = new.canal_id
    and empresa_id = new.empresa_id;

  if coalesce(v_config->>'whatsapp_account_model', 'legacy_waba') = 'shared_waac_pma'
    and nullif(v_config->>'pma_id', '') is not null then
    new.waac_id := nullif(v_config->>'waac_id', '');
    new.pma_id := nullif(v_config->>'pma_id', '');
    new.external_partner := nullif(v_config->>'external_partner', '');
    new.billing_account_kind := 'pma';
  else
    new.billing_account_kind := 'legacy_waba';
  end if;

  return new;
end;
$$;

drop trigger if exists assign_inbox_meta_cost_messaging_account
on public.inbox_meta_costos_mensajes;

create trigger assign_inbox_meta_cost_messaging_account
before insert or update of canal_id on public.inbox_meta_costos_mensajes
for each row execute function public.asignar_inbox_meta_costo_cuenta_mensajeria();

-- Preserve historical cost rows where a channel already has the new identifiers.
update public.inbox_meta_costos_mensajes as cost
set
  waac_id = nullif(channel.configuracion_publica->>'waac_id', ''),
  pma_id = nullif(channel.configuracion_publica->>'pma_id', ''),
  external_partner = nullif(channel.configuracion_publica->>'external_partner', ''),
  billing_account_kind = case
    when channel.configuracion_publica->>'whatsapp_account_model' = 'shared_waac_pma'
      and nullif(channel.configuracion_publica->>'pma_id', '') is not null
      then 'pma'
    else 'legacy_waba'
  end
from public.inbox_canales as channel
where channel.id = cost.canal_id
  and channel.empresa_id = cost.empresa_id;

-- This configuration belongs to biz.os only. The external partner does not
-- receive credentials; it is recorded to make the shared number operationally
-- safe and auditable.
create or replace function public.actualizar_inbox_canal_meta_numero_compartido(
  p_canal_id uuid,
  p_whatsapp_account_model text default 'legacy_waba',
  p_waac_id text default null,
  p_pma_id text default null,
  p_external_partner text default null,
  p_automation_owner text default 'bizos'
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_before public.inbox_canales%rowtype;
  v_after public.inbox_canales%rowtype;
  v_model text := lower(btrim(coalesce(p_whatsapp_account_model, 'legacy_waba')));
  v_owner text := lower(btrim(coalesce(p_automation_owner, 'bizos')));
  v_waac_id text := nullif(btrim(coalesce(p_waac_id, '')), '');
  v_pma_id text := nullif(btrim(coalesce(p_pma_id, '')), '');
  v_partner text := nullif(btrim(coalesce(p_external_partner, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  select * into v_before
  from public.inbox_canales
  where id = p_canal_id
    and empresa_id = v_empresa_id;

  if v_before.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_before.proveedor <> 'meta' or v_before.canal <> 'whatsapp' then
    raise exception 'El canal no es WhatsApp Meta.' using errcode = '22023';
  end if;

  if v_model not in ('legacy_waba', 'shared_waac_pma') then
    raise exception 'Modelo de cuenta WhatsApp invalido.' using errcode = '22023';
  end if;

  if v_owner not in ('bizos', 'external', 'manual') then
    raise exception 'Propietario de automatizaciones invalido.' using errcode = '22023';
  end if;

  if v_model = 'shared_waac_pma' and (v_waac_id is null or v_pma_id is null) then
    raise exception 'WAAC ID y PMA ID son obligatorios para un numero compartido.' using errcode = '22023';
  end if;

  if v_model = 'shared_waac_pma' and v_owner = 'external' and v_partner is null then
    raise exception 'Indica el socio externo que controla las automatizaciones.' using errcode = '22023';
  end if;

  update public.inbox_canales as c
  set configuracion_publica =
        (coalesce(c.configuracion_publica, '{}'::jsonb)
          - 'whatsapp_account_model'
          - 'waac_id'
          - 'pma_id'
          - 'external_partner'
          - 'automation_owner')
        || jsonb_strip_nulls(jsonb_build_object(
          'whatsapp_account_model', v_model,
          'waac_id', case when v_model = 'shared_waac_pma' then v_waac_id else null end,
          'pma_id', case when v_model = 'shared_waac_pma' then v_pma_id else null end,
          'external_partner', case when v_model = 'shared_waac_pma' then v_partner else null end,
          'automation_owner', case when v_model = 'shared_waac_pma' then v_owner else 'bizos' end
        )),
      updated_by = v_user_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_after;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues
  ) values (
    v_empresa_id,
    v_user_id,
    'inbox_canales',
    p_canal_id,
    'actualizar_inbox_canal_meta_numero_compartido',
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return next v_after;
end;
$$;

revoke all on function public.asignar_inbox_meta_costo_cuenta_mensajeria() from public;
revoke all on function public.actualizar_inbox_canal_meta_numero_compartido(uuid, text, text, text, text, text) from public;
grant execute on function public.actualizar_inbox_canal_meta_numero_compartido(uuid, text, text, text, text, text) to authenticated;
