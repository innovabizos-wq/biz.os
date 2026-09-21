-- Server-driven, idempotent CRM follow-up reminders.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.followup_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  followup_id uuid not null references public.crm_seguimientos(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null,
  scheduled_at timestamptz not null,
  lead_minutes integer not null,
  notification_id uuid references public.user_notifications(id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint followup_reminder_deliveries_unique
    unique (empresa_id, followup_id, recipient_profile_id, reminder_kind, scheduled_at),
  constraint followup_reminder_deliveries_kind_check
    check (reminder_kind in ('before_due', 'due_now')),
  constraint followup_reminder_deliveries_lead_check
    check (lead_minutes between 1 and 1440)
);

create index if not exists crm_seguimientos_pending_due_idx
  on public.crm_seguimientos (fecha_programada, empresa_id, asignado_a)
  where estado = 'pendiente' and asignado_a is not null;

create index if not exists followup_reminder_deliveries_company_created_idx
  on public.followup_reminder_deliveries (empresa_id, created_at desc);

alter table public.followup_reminder_deliveries enable row level security;
revoke all on public.followup_reminder_deliveries from public, anon, authenticated;
grant select on public.followup_reminder_deliveries to service_role;

insert into public.followup_reminder_deliveries (
  empresa_id,
  followup_id,
  recipient_profile_id,
  reminder_kind,
  scheduled_at,
  lead_minutes,
  notification_id,
  delivered_at,
  created_at
)
select
  notification.empresa_id,
  notification.entity_id,
  notification.recipient_profile_id,
  notification.metadata ->> 'reminderKind',
  followup.fecha_programada,
  case
    when notification.metadata ->> 'leadMinutes' ~ '^[0-9]{1,4}$'
      then greatest(1, least(1440, (notification.metadata ->> 'leadMinutes')::integer))
    else 30
  end,
  notification.id,
  notification.created_at,
  notification.created_at
from public.user_notifications as notification
join public.crm_seguimientos as followup
  on followup.id = notification.entity_id
 and followup.empresa_id = notification.empresa_id
where notification.entity_type = 'crm_followup'
  and notification.metadata ->> 'source' = 'followup_reminder'
  and notification.metadata ->> 'reminderKind' in ('before_due', 'due_now')
on conflict on constraint followup_reminder_deliveries_unique do nothing;

create or replace function private.enqueue_followup_reminders(
  p_empresa_id uuid default null,
  p_profile_id uuid default null,
  p_lead_minutes_override integer default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_candidate record;
  v_created integer := 0;
  v_delivery_id uuid;
  v_notification_id uuid;
  v_reviewed integer := 0;
  v_skipped integer := 0;
begin
  if p_limit < 1 or p_limit > 1000 then
    raise exception using errcode = '22023', message = 'REMINDER_LIMIT_INVALID';
  end if;
  if p_lead_minutes_override is not null
    and (p_lead_minutes_override < 1 or p_lead_minutes_override > 1440) then
    raise exception using errcode = '22023', message = 'REMINDER_LEAD_INVALID';
  end if;

  for v_candidate in
    select
      followup.asunto,
      followup.cliente_id,
      followup.empresa_id,
      followup.fecha_programada,
      followup.id as followup_id,
      customer.nombre as customer_name,
      profile.id as recipient_profile_id,
      limits.lead_minutes
    from public.crm_seguimientos as followup
    join public.empresas as company
      on company.id = followup.empresa_id
     and company.estado = 'activa'
    join public.profiles as profile
      on profile.id = followup.asignado_a
     and profile.empresa_id = followup.empresa_id
     and profile.estado = 'activo'
    join public.crm_clientes as customer
      on customer.id = followup.cliente_id
     and customer.empresa_id = followup.empresa_id
    left join public.configuraciones_empresa as settings
      on settings.empresa_id = followup.empresa_id
     and settings.clave = 'notifications'
    cross join lateral (
      select coalesce(
        p_lead_minutes_override,
        case
          when settings.valor ->> 'followupReminderLeadMinutes' ~ '^[0-9]{1,4}$'
            then greatest(
              1,
              least(1440, (settings.valor ->> 'followupReminderLeadMinutes')::integer)
            )
          else 30
        end
      )::integer as lead_minutes
    ) as limits
    where followup.estado = 'pendiente'
      and followup.asignado_a is not null
      and (p_empresa_id is null or followup.empresa_id = p_empresa_id)
      and (p_profile_id is null or followup.asignado_a = p_profile_id)
      and followup.fecha_programada <= now() + make_interval(mins => limits.lead_minutes)
    order by followup.fecha_programada, followup.id
    limit p_limit
  loop
    v_reviewed := v_reviewed + 1;
    v_delivery_id := null;

    insert into public.followup_reminder_deliveries (
      empresa_id,
      followup_id,
      recipient_profile_id,
      reminder_kind,
      scheduled_at,
      lead_minutes
    ) values (
      v_candidate.empresa_id,
      v_candidate.followup_id,
      v_candidate.recipient_profile_id,
      case
        when v_candidate.fecha_programada <= now() then 'due_now'
        else 'before_due'
      end,
      v_candidate.fecha_programada,
      v_candidate.lead_minutes
    )
    on conflict on constraint followup_reminder_deliveries_unique do nothing
    returning id into v_delivery_id;

    if v_delivery_id is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.user_notifications (
      empresa_id,
      recipient_profile_id,
      actor_profile_id,
      type,
      title,
      message,
      href,
      entity_type,
      entity_id,
      metadata
    ) values (
      v_candidate.empresa_id,
      v_candidate.recipient_profile_id,
      null,
      'task',
      case
        when v_candidate.fecha_programada <= now() then 'Seguimiento pendiente ahora'
        else 'Seguimiento proximo'
      end,
      case
        when v_candidate.fecha_programada <= now()
          then format('Ya es momento de trabajar el seguimiento de %s.', v_candidate.customer_name)
        else format(
          'Tienes un seguimiento para %s en %s minutos o menos.',
          v_candidate.customer_name,
          v_candidate.lead_minutes
        )
      end,
      '/agenda/seguimientos',
      'crm_followup',
      v_candidate.followup_id,
      jsonb_build_object(
        'clienteId', v_candidate.cliente_id,
        'leadMinutes', v_candidate.lead_minutes,
        'reminderKind', case
          when v_candidate.fecha_programada <= now() then 'due_now'
          else 'before_due'
        end,
        'scheduledAt', v_candidate.fecha_programada,
        'source', 'followup_reminder'
      )
    )
    returning id into v_notification_id;

    update public.followup_reminder_deliveries
    set notification_id = v_notification_id,
        delivered_at = now()
    where id = v_delivery_id;

    v_created := v_created + 1;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'reviewed', v_reviewed,
    'skipped', v_skipped
  );
end;
$$;

create or replace function public.enqueue_due_followup_reminders(
  p_limit integer default 500
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.enqueue_followup_reminders(null, null, null, p_limit);
$$;

create or replace function public.enqueue_my_due_followup_reminders(
  p_lead_minutes integer default 30,
  p_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_profile_id uuid := auth.uid();
begin
  if v_empresa_id is null or v_profile_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not public.current_user_has_permission('crm.followups.view') then
    raise exception using errcode = '42501', message = 'REMINDER_PERMISSION_DENIED';
  end if;

  return private.enqueue_followup_reminders(
    v_empresa_id,
    v_profile_id,
    p_lead_minutes,
    least(100, greatest(1, p_limit))
  );
end;
$$;

revoke all on function private.enqueue_followup_reminders(uuid,uuid,integer,integer)
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_due_followup_reminders(integer)
  from public, anon, authenticated;
grant execute on function public.enqueue_due_followup_reminders(integer)
  to service_role;
revoke all on function public.enqueue_my_due_followup_reminders(integer,integer)
  from public, anon;
grant execute on function public.enqueue_my_due_followup_reminders(integer,integer)
  to authenticated;

comment on table public.followup_reminder_deliveries is
  'Idempotency ledger for server and interactive CRM follow-up reminders.';
comment on function public.enqueue_due_followup_reminders(integer) is
  'Service-only scheduler entry point for due CRM follow-up reminders.';
