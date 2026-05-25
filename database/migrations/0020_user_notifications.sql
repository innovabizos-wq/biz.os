create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  type text not null default 'info',
  title text not null,
  message text,
  href text,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_notifications_type_check
    check (type in (
      'info',
      'success',
      'warning',
      'error',
      'task',
      'crm',
      'quote',
      'sale',
      'dispatch',
      'inventory',
      'system'
    ))
);

create index user_notifications_empresa_recipient_created_idx
  on public.user_notifications (empresa_id, recipient_profile_id, created_at desc);
create index user_notifications_empresa_recipient_read_idx
  on public.user_notifications (empresa_id, recipient_profile_id, read_at);
create index user_notifications_empresa_recipient_idx
  on public.user_notifications (empresa_id, recipient_profile_id);
create index user_notifications_empresa_entity_idx
  on public.user_notifications (empresa_id, entity_type, entity_id);
create index user_notifications_created_idx
  on public.user_notifications (created_at desc);

alter table public.user_notifications enable row level security;

grant select on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;

create policy user_notifications_select_own
on public.user_notifications
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and recipient_profile_id = auth.uid()
);

create policy user_notifications_update_own_read_at
on public.user_notifications
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and recipient_profile_id = auth.uid()
)
with check (
  empresa_id = public.current_empresa_id()
  and recipient_profile_id = auth.uid()
);

create or replace function public.crear_notificacion_usuario(
  p_recipient_profile_id uuid,
  p_type text,
  p_title text,
  p_message text default null,
  p_href text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  type text,
  title text,
  message text,
  href text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_notification public.user_notifications%rowtype;
begin
  if v_actor_profile_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_recipient_profile_id is null then
    raise exception 'Usuario destinatario requerido.' using errcode = '22023';
  end if;

  if p_recipient_profile_id <> v_actor_profile_id
    and not public.current_user_has_permission('admin.users.manage') then
    raise exception 'No autorizado para crear notificaciones a otros usuarios.' using errcode = '42501';
  end if;

  if p_type not in (
    'info',
    'success',
    'warning',
    'error',
    'task',
    'crm',
    'quote',
    'sale',
    'dispatch',
    'inventory',
    'system'
  ) then
    raise exception 'Tipo de notificacion invalido.' using errcode = '22023';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Titulo de notificacion requerido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as pr
    where pr.id = p_recipient_profile_id
      and pr.empresa_id = v_empresa_id
      and pr.estado = 'activo'
  ) then
    raise exception 'Destinatario invalido para la empresa actual.' using errcode = '23503';
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
  )
  values (
    v_empresa_id,
    p_recipient_profile_id,
    v_actor_profile_id,
    p_type,
    trim(p_title),
    nullif(trim(p_message), ''),
    nullif(trim(p_href), ''),
    nullif(trim(p_entity_type), ''),
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_notification;

  return query
  select
    v_notification.id,
    v_notification.type,
    v_notification.title,
    v_notification.message,
    v_notification.href,
    v_notification.entity_type,
    v_notification.entity_id,
    v_notification.metadata,
    v_notification.read_at,
    v_notification.created_at;
end;
$$;

create or replace function public.crear_notificacion_propia(
  p_type text,
  p_title text,
  p_message text default null,
  p_href text default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  type text,
  title text,
  message text,
  href text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select *
  from public.crear_notificacion_usuario(
    auth.uid(),
    p_type,
    p_title,
    p_message,
    p_href,
    p_entity_type,
    p_entity_id,
    p_metadata
  );
$$;

create or replace function public.obtener_mis_notificaciones(
  p_limit integer default 20,
  p_only_unread boolean default false
)
returns table (
  id uuid,
  type text,
  title text,
  message text,
  href text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz,
  actor_name text,
  is_read boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_profile_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  return query
  select
    n.id,
    n.type,
    n.title,
    n.message,
    n.href,
    n.entity_type,
    n.entity_id,
    n.metadata,
    n.read_at,
    n.created_at,
    actor.nombre as actor_name,
    n.read_at is not null as is_read
  from public.user_notifications as n
  left join public.profiles as actor
    on actor.id = n.actor_profile_id
    and actor.empresa_id = v_empresa_id
  where n.empresa_id = v_empresa_id
    and n.recipient_profile_id = v_profile_id
    and (not coalesce(p_only_unread, false) or n.read_at is null)
  order by n.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.contar_mis_notificaciones_no_leidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_count integer;
begin
  if v_profile_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  select count(*)::integer
  into v_count
  from public.user_notifications as n
  where n.empresa_id = v_empresa_id
    and n.recipient_profile_id = v_profile_id
    and n.read_at is null;

  return coalesce(v_count, 0);
end;
$$;

create or replace function public.marcar_notificacion_leida(
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_profile_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  update public.user_notifications as n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.empresa_id = v_empresa_id
    and n.recipient_profile_id = v_profile_id;

  return found;
end;
$$;

create or replace function public.marcar_todas_mis_notificaciones_leidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_updated integer;
begin
  if v_profile_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  update public.user_notifications as n
  set read_at = now()
  where n.empresa_id = v_empresa_id
    and n.recipient_profile_id = v_profile_id
    and n.read_at is null;

  get diagnostics v_updated = row_count;

  return coalesce(v_updated, 0);
end;
$$;

revoke all on function public.crear_notificacion_usuario(uuid, text, text, text, text, text, uuid, jsonb) from public;
revoke all on function public.crear_notificacion_propia(text, text, text, text, text, uuid, jsonb) from public;
revoke all on function public.obtener_mis_notificaciones(integer, boolean) from public;
revoke all on function public.contar_mis_notificaciones_no_leidas() from public;
revoke all on function public.marcar_notificacion_leida(uuid) from public;
revoke all on function public.marcar_todas_mis_notificaciones_leidas() from public;

grant execute on function public.crear_notificacion_usuario(uuid, text, text, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.crear_notificacion_propia(text, text, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.obtener_mis_notificaciones(integer, boolean) to authenticated;
grant execute on function public.contar_mis_notificaciones_no_leidas() to authenticated;
grant execute on function public.marcar_notificacion_leida(uuid) to authenticated;
grant execute on function public.marcar_todas_mis_notificaciones_leidas() to authenticated;
