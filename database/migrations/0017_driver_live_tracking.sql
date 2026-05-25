-- biz.os driver live tracking foundation.
-- Apply manually in Supabase SQL Editor after 0016b.

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('driver.tracking.use', 'Usar tracking de chofer', 'Permite actualizar el estado y ubicacion propia de chofer.', 'dispatch', 'activo'),
  ('driver.tracking.view', 'Ver tracking de choferes', 'Permite consultar choferes conectados y ubicacion actual.', 'dispatch', 'activo'),
  ('driver.tracking.manage', 'Gestionar tracking de choferes', 'Permite administrar estados de tracking de choferes.', 'dispatch', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'driver.tracking.use',
    'driver.tracking.view',
    'driver.tracking.manage'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

create table if not exists public.driver_live_status (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'offline',
  latitude numeric,
  longitude numeric,
  accuracy numeric,
  speed numeric,
  heading numeric,
  battery_level numeric,
  last_seen_at timestamptz,
  tracking_enabled boolean not null default false,
  current_dispatch_id uuid references public.despachos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint driver_live_status_empresa_profile_unique unique (empresa_id, profile_id),
  constraint driver_live_status_estado_check
    check (estado in ('available', 'on_route', 'lunch', 'paused', 'finished', 'offline', 'incident')),
  constraint driver_live_status_latitude_check
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  constraint driver_live_status_longitude_check
    check (longitude is null or (longitude >= -180 and longitude <= 180)),
  constraint driver_live_status_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint driver_live_status_current_dispatch_empresa_fkey
    foreign key (current_dispatch_id, empresa_id)
    references public.despachos(id, empresa_id)
    on delete set null (current_dispatch_id)
);

create index if not exists driver_live_status_empresa_id_idx
  on public.driver_live_status (empresa_id);
create index if not exists driver_live_status_empresa_profile_idx
  on public.driver_live_status (empresa_id, profile_id);
create index if not exists driver_live_status_empresa_estado_idx
  on public.driver_live_status (empresa_id, estado);
create index if not exists driver_live_status_empresa_last_seen_idx
  on public.driver_live_status (empresa_id, last_seen_at);
create index if not exists driver_live_status_empresa_tracking_idx
  on public.driver_live_status (empresa_id, tracking_enabled);

drop trigger if exists set_driver_live_status_updated_at on public.driver_live_status;
create trigger set_driver_live_status_updated_at
before update on public.driver_live_status
for each row execute function public.set_updated_at();

alter table public.driver_live_status enable row level security;

grant select, update on public.driver_live_status to authenticated;

drop policy if exists driver_live_status_select_own_or_permission on public.driver_live_status;
create policy driver_live_status_select_own_or_permission
on public.driver_live_status
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    profile_id = auth.uid()
    or public.current_user_has_permission('dispatch.orders.view')
    or public.current_user_has_permission('dispatch.orders.edit')
    or public.current_user_has_permission('driver.tracking.view')
    or public.current_user_has_permission('driver.tracking.manage')
  )
);

drop policy if exists driver_live_status_update_own on public.driver_live_status;
create policy driver_live_status_update_own
on public.driver_live_status
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
  and public.current_user_has_permission('driver.tracking.use')
)
with check (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
  and public.current_user_has_permission('driver.tracking.use')
);

create or replace function public.obtener_choferes_en_vivo()
returns table (
  profile_id uuid,
  nombre text,
  correo text,
  estado text,
  latitude numeric,
  longitude numeric,
  accuracy numeric,
  speed numeric,
  heading numeric,
  battery_level numeric,
  last_seen_at timestamptz,
  tracking_enabled boolean,
  is_online boolean,
  current_dispatch_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('dispatch.orders.view')
    or public.current_user_has_permission('dispatch.orders.edit')
    or public.current_user_has_permission('driver.tracking.view')
    or public.current_user_has_permission('driver.tracking.manage')
  ) then
    raise exception 'Permiso de tracking requerido.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.nombre,
    p.correo,
    dls.estado,
    dls.latitude,
    dls.longitude,
    dls.accuracy,
    dls.speed,
    dls.heading,
    dls.battery_level,
    dls.last_seen_at,
    dls.tracking_enabled,
    (dls.tracking_enabled = true and dls.last_seen_at >= now() - interval '2 minutes'),
    dls.current_dispatch_id
  from public.driver_live_status as dls
  join public.profiles as p
    on p.id = dls.profile_id
   and p.empresa_id = dls.empresa_id
  left join public.roles as r
    on r.id = p.rol_id
   and r.empresa_id = p.empresa_id
  where dls.empresa_id = v_empresa_id
    and p.estado = 'activo'
    and (
      lower(coalesce(r.nombre, '')) = 'chofer'
      or exists (
        select 1
        from public.rol_permisos as rp
        join public.permisos as perm
          on perm.id = rp.permiso_id
        where rp.empresa_id = p.empresa_id
          and rp.rol_id = p.rol_id
          and perm.codigo = 'driver.tracking.use'
      )
      or dls.tracking_enabled = true
    )
  order by dls.last_seen_at desc nulls last, p.nombre;
end;
$$;

create or replace function public.obtener_resumen_choferes_en_vivo()
returns table (
  connected_drivers integer,
  available_drivers integer,
  on_route_drivers integer,
  lunch_drivers integer,
  paused_drivers integer,
  incident_drivers integer,
  offline_drivers integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('dispatch.orders.view')
    or public.current_user_has_permission('dispatch.orders.edit')
    or public.current_user_has_permission('driver.tracking.view')
    or public.current_user_has_permission('driver.tracking.manage')
  ) then
    raise exception 'Permiso de tracking requerido.' using errcode = '42501';
  end if;

  return query
  with live as (
    select
      dls.estado,
      (dls.tracking_enabled = true and dls.last_seen_at >= now() - interval '2 minutes') as is_online
    from public.driver_live_status as dls
    join public.profiles as p
      on p.id = dls.profile_id
     and p.empresa_id = dls.empresa_id
    where dls.empresa_id = v_empresa_id
      and p.estado = 'activo'
  )
  select
    count(*) filter (where is_online)::integer,
    count(*) filter (where is_online and estado = 'available')::integer,
    count(*) filter (where is_online and estado = 'on_route')::integer,
    count(*) filter (where is_online and estado = 'lunch')::integer,
    count(*) filter (where is_online and estado = 'paused')::integer,
    count(*) filter (where is_online and estado = 'incident')::integer,
    count(*) filter (where not is_online)::integer
  from live;
end;
$$;

create or replace function public.upsert_estado_chofer_admin(
  p_profile_id uuid,
  p_estado text,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  profile_id uuid,
  estado text,
  latitude numeric,
  longitude numeric,
  last_seen_at timestamptz,
  tracking_enabled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_status public.driver_live_status%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('driver.tracking.manage') then
    raise exception 'Permiso driver.tracking.manage requerido.' using errcode = '42501';
  end if;

  if p_estado not in ('available', 'on_route', 'lunch', 'paused', 'finished', 'offline', 'incident') then
    raise exception 'Estado de chofer invalido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = p_profile_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Profile no encontrado.' using errcode = '02000';
  end if;

  insert into public.driver_live_status (
    empresa_id,
    profile_id,
    estado,
    latitude,
    longitude,
    last_seen_at,
    tracking_enabled
  )
  values (
    v_empresa_id,
    p_profile_id,
    p_estado,
    p_latitude,
    p_longitude,
    now(),
    p_estado <> 'offline'
  )
  on conflict (empresa_id, profile_id) do update
  set estado = excluded.estado,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      last_seen_at = excluded.last_seen_at,
      tracking_enabled = excluded.tracking_enabled
  returning * into v_status;

  return query
  select
    v_status.profile_id,
    v_status.estado,
    v_status.latitude,
    v_status.longitude,
    v_status.last_seen_at,
    v_status.tracking_enabled;
end;
$$;

revoke all on function public.obtener_choferes_en_vivo() from public;
revoke all on function public.obtener_resumen_choferes_en_vivo() from public;
revoke all on function public.upsert_estado_chofer_admin(uuid, text, numeric, numeric) from public;

grant execute on function public.obtener_choferes_en_vivo() to authenticated;
grant execute on function public.obtener_resumen_choferes_en_vivo() to authenticated;
grant execute on function public.upsert_estado_chofer_admin(uuid, text, numeric, numeric) to authenticated;
