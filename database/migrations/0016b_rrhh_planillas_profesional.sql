-- biz.os professional HR timesheets correction.
-- Apply manually in Supabase SQL Editor after 0016 if it was already applied,
-- or after 0015 if 0016 has not been applied yet.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values
  ('hr', 'RRHH', 'Planillas, asistencia y estados diarios.', 'activo', 70)
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    estado = excluded.estado,
    orden = excluded.orden;

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('hr.timesheets.view', 'Ver planillas', 'Permite consultar planillas de RRHH.', 'hr', 'activo'),
  ('hr.timesheets.manage', 'Gestionar planillas', 'Permite gestionar la operacion diaria de planillas.', 'hr', 'activo'),
  ('hr.timesheets.register', 'Registrar estado laboral', 'Permite registrar estados laborales propios.', 'hr', 'activo'),
  ('hr.timesheets.dashboard', 'Ver dashboard de planillas', 'Permite ver el dashboard operativo de planillas.', 'hr', 'activo'),
  ('hr.timesheets.states.manage', 'Gestionar estados de planilla', 'Permite crear, editar y activar estados laborales.', 'hr', 'activo')
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
    'hr.timesheets.view',
    'hr.timesheets.manage',
    'hr.timesheets.register',
    'hr.timesheets.dashboard',
    'hr.timesheets.states.manage'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

insert into public.empresa_modulos (empresa_id, modulo_id)
select e.id, m.id
from public.empresas as e
join public.modulos as m
  on m.codigo = 'hr'
where m.estado = 'activo'
on conflict on constraint empresa_modulos_empresa_modulo_unique
do nothing;

create table if not exists public.rrhh_planilla_estados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  tipo text not null default 'operativo',
  color text,
  orden integer not null default 0,
  requiere_regreso boolean not null default false,
  estado_regreso_codigo text,
  es_estado_inicial boolean not null default false,
  es_estado_final boolean not null default false,
  cuenta_como_trabajo boolean not null default false,
  cuenta_como_pausa boolean not null default false,
  activo boolean not null default true,
  es_sistema boolean not null default false,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint rrhh_planilla_estados_empresa_codigo_unique unique (empresa_id, codigo),
  constraint rrhh_planilla_estados_id_empresa_unique unique (id, empresa_id),
  constraint rrhh_planilla_estados_tipo_check
    check (tipo in ('entrada', 'salida', 'pausa', 'regreso', 'almuerzo', 'break', 'descanso_activo', 'operativo', 'personalizado')),
  constraint rrhh_planilla_estados_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por),
  constraint rrhh_planilla_estados_actualizado_por_empresa_fkey
    foreign key (actualizado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (actualizado_por)
);

create index if not exists rrhh_planilla_estados_empresa_id_idx
  on public.rrhh_planilla_estados (empresa_id);
create index if not exists rrhh_planilla_estados_empresa_activo_idx
  on public.rrhh_planilla_estados (empresa_id, activo);
create index if not exists rrhh_planilla_estados_empresa_orden_idx
  on public.rrhh_planilla_estados (empresa_id, orden);

create unique index if not exists rrhh_planilla_estados_id_empresa_unique_idx
  on public.rrhh_planilla_estados (id, empresa_id);

drop trigger if exists set_rrhh_planilla_estados_updated_at on public.rrhh_planilla_estados;
create trigger set_rrhh_planilla_estados_updated_at
before update on public.rrhh_planilla_estados
for each row execute function public.set_updated_at();

create table if not exists public.rrhh_planilla_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null,
  estado text,
  estado_id uuid,
  estado_codigo text,
  estado_nombre text,
  fecha date not null default current_date,
  registrado_at timestamptz not null default now(),
  origen text not null default 'sidebar',
  nota text,
  notas text,
  creado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.rrhh_planilla_eventos
  add column if not exists estado text,
  add column if not exists estado_id uuid,
  add column if not exists estado_codigo text,
  add column if not exists estado_nombre text,
  add column if not exists fecha date not null default current_date,
  add column if not exists origen text not null default 'sidebar',
  add column if not exists nota text,
  add column if not exists notas text;

alter table public.rrhh_planilla_eventos
  drop constraint if exists rrhh_planilla_eventos_estado_check,
  drop constraint if exists rrhh_planilla_eventos_origen_check,
  add constraint rrhh_planilla_eventos_origen_check
    check (origen in ('sidebar', 'dashboard', 'admin', 'sistema'));

alter table public.rrhh_planilla_eventos
  drop constraint if exists rrhh_planilla_eventos_profile_empresa_fkey,
  add constraint rrhh_planilla_eventos_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  drop constraint if exists rrhh_planilla_eventos_creado_por_empresa_fkey,
  add constraint rrhh_planilla_eventos_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por);

update public.rrhh_planilla_eventos as e
set estado_codigo = coalesce(e.estado_codigo, e.estado),
    estado_nombre = coalesce(
      e.estado_nombre,
      case coalesce(e.estado_codigo, e.estado)
        when 'login' then 'Login'
        when 'almuerzo' then 'Almuerzo'
        when 'almuerzo_inicio' then 'Almuerzo'
        when 'regreso_almuerzo' then 'Regreso de almuerzo'
        when 'almuerzo_fin' then 'Regreso de almuerzo'
        when 'pausa' then 'Pausa'
        when 'pausa_inicio' then 'Pausa'
        when 'regreso_pausa' then 'Regreso de pausa'
        when 'pausa_fin' then 'Regreso de pausa'
        when 'salida' then 'Salida'
        when 'logout' then 'Salida'
        else initcap(replace(coalesce(e.estado_codigo, e.estado), '_', ' '))
      end
    ),
    notas = coalesce(e.notas, e.nota),
    fecha = coalesce(e.fecha, e.registrado_at::date)
where e.estado_codigo is null
   or e.estado_nombre is null
   or e.notas is null;

alter table public.rrhh_planilla_eventos
  alter column estado_codigo set not null,
  alter column estado_nombre set not null;

alter table public.rrhh_planilla_eventos
  drop constraint if exists rrhh_planilla_eventos_estado_empresa_fkey,
  add constraint rrhh_planilla_eventos_estado_empresa_fkey
    foreign key (estado_id, empresa_id)
    references public.rrhh_planilla_estados(id, empresa_id)
    on delete restrict;

create index if not exists rrhh_planilla_eventos_empresa_profile_fecha_idx
  on public.rrhh_planilla_eventos (empresa_id, profile_id, fecha);
create index if not exists rrhh_planilla_eventos_empresa_fecha_idx
  on public.rrhh_planilla_eventos (empresa_id, fecha);
create index if not exists rrhh_planilla_eventos_empresa_estado_codigo_idx
  on public.rrhh_planilla_eventos (empresa_id, estado_codigo);
create index if not exists rrhh_planilla_eventos_empresa_registrado_at_idx
  on public.rrhh_planilla_eventos (empresa_id, registrado_at desc);

alter table public.rrhh_planilla_estados enable row level security;
alter table public.rrhh_planilla_eventos enable row level security;

grant select on public.rrhh_planilla_estados to authenticated;
grant select on public.rrhh_planilla_eventos to authenticated;

drop policy if exists rrhh_planilla_estados_select_permission on public.rrhh_planilla_estados;
create policy rrhh_planilla_estados_select_permission
on public.rrhh_planilla_estados
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('hr.timesheets.view')
    or public.current_user_has_permission('hr.timesheets.register')
    or public.current_user_has_permission('hr.timesheets.dashboard')
    or public.current_user_has_permission('hr.timesheets.states.manage')
  )
);

drop policy if exists rrhh_planilla_eventos_select_permission on public.rrhh_planilla_eventos;
create policy rrhh_planilla_eventos_select_permission
on public.rrhh_planilla_eventos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('hr.timesheets.view')
    or public.current_user_has_permission('hr.timesheets.dashboard')
    or public.current_user_has_permission('hr.timesheets.manage')
    or (
      public.current_user_has_permission('hr.timesheets.register')
      and profile_id = auth.uid()
    )
  )
);

drop function if exists public.inicializar_rrhh_planilla_estados_empresa();
drop function if exists public.registrar_rrhh_planilla_estado(text, text);
drop function if exists public.obtener_rrhh_estado_actual_usuario();
drop function if exists public.obtener_rrhh_planilla_dashboard(date);
drop function if exists public.crear_rrhh_planilla_estado(text, text, text, text, integer, boolean, text, boolean, boolean);
drop function if exists public.actualizar_rrhh_planilla_estado(uuid, text, text, text, text, integer, boolean, text, boolean, boolean);
drop function if exists public.cambiar_estado_rrhh_planilla_estado(uuid, boolean);

create or replace function public.inicializar_rrhh_planilla_estados_empresa()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_count integer;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('hr.timesheets.states.manage')
    or public.current_user_has_permission('hr.timesheets.manage')
  ) then
    raise exception 'Permiso hr.timesheets.states.manage requerido.' using errcode = '42501';
  end if;

  insert into public.rrhh_planilla_estados (
    empresa_id, codigo, nombre, tipo, color, orden, requiere_regreso,
    estado_regreso_codigo, es_estado_inicial, es_estado_final,
    cuenta_como_trabajo, cuenta_como_pausa, activo, es_sistema,
    creado_por, actualizado_por
  )
  values
    (v_empresa_id, 'login', 'Login', 'entrada', '#16a34a', 10, false, null, true, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'almuerzo', 'Almuerzo', 'almuerzo', '#f59e0b', 20, true, 'regreso_almuerzo', false, false, false, true, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'regreso_almuerzo', 'Regreso de almuerzo', 'regreso', '#22c55e', 30, false, null, false, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'pausa', 'Pausa', 'pausa', '#0ea5e9', 40, true, 'regreso_pausa', false, false, false, true, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'regreso_pausa', 'Regreso de pausa', 'regreso', '#38bdf8', 50, false, null, false, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'break_1', 'Break 1', 'break', '#8b5cf6', 60, true, 'regreso_break_1', false, false, false, true, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'regreso_break_1', 'Regreso Break 1', 'regreso', '#a78bfa', 70, false, null, false, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'break_2', 'Break 2', 'break', '#7c3aed', 80, true, 'regreso_break_2', false, false, false, true, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'regreso_break_2', 'Regreso Break 2', 'regreso', '#c4b5fd', 90, false, null, false, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'descanso_activo', 'Descanso activo', 'descanso_activo', '#14b8a6', 100, false, null, false, false, true, false, true, true, v_user_id, v_user_id),
    (v_empresa_id, 'salida', 'Salida', 'salida', '#ef4444', 110, false, null, false, true, false, false, true, true, v_user_id, v_user_id)
  on conflict (empresa_id, codigo) do update
  set nombre = excluded.nombre,
      tipo = excluded.tipo,
      color = excluded.color,
      orden = excluded.orden,
      requiere_regreso = excluded.requiere_regreso,
      estado_regreso_codigo = excluded.estado_regreso_codigo,
      es_estado_inicial = excluded.es_estado_inicial,
      es_estado_final = excluded.es_estado_final,
      cuenta_como_trabajo = excluded.cuenta_como_trabajo,
      cuenta_como_pausa = excluded.cuenta_como_pausa,
      es_sistema = true,
      actualizado_por = v_user_id;

  get diagnostics v_count = row_count;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_estados',
    v_empresa_id,
    'inicializar_rrhh_planilla_estados_empresa',
    jsonb_build_object('estados_afectados', v_count)
  );

  return v_count;
end;
$$;

create or replace function public.registrar_rrhh_planilla_estado(
  p_estado_codigo text,
  p_notas text default null
)
returns table (
  evento_id uuid,
  profile_id uuid,
  estado_codigo text,
  estado_nombre text,
  fecha date,
  registrado_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_estado public.rrhh_planilla_estados%rowtype;
  v_evento public.rrhh_planilla_eventos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Profile activo requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('hr.timesheets.register') then
    raise exception 'Permiso hr.timesheets.register requerido.' using errcode = '42501';
  end if;

  select e.* into v_estado
  from public.rrhh_planilla_estados as e
  where e.empresa_id = v_empresa_id
    and e.codigo = lower(btrim(p_estado_codigo))
    and e.activo = true;

  if v_estado.id is null then
    raise exception 'Estado laboral no disponible.' using errcode = '02000';
  end if;

  insert into public.rrhh_planilla_eventos (
    empresa_id,
    profile_id,
    estado_id,
    estado_codigo,
    estado_nombre,
    fecha,
    registrado_at,
    origen,
    notas,
    creado_por,
    estado,
    nota
  )
  values (
    v_empresa_id,
    v_user_id,
    v_estado.id,
    v_estado.codigo,
    v_estado.nombre,
    current_date,
    now(),
    'sidebar',
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id,
    v_estado.codigo,
    nullif(btrim(coalesce(p_notas, '')), '')
  )
  returning * into v_evento;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_eventos',
    v_evento.id,
    'registrar_rrhh_planilla_estado',
    to_jsonb(v_evento)
  );

  return query
  select
    v_evento.id,
    v_evento.profile_id,
    v_evento.estado_codigo,
    v_evento.estado_nombre,
    v_evento.fecha,
    v_evento.registrado_at;
end;
$$;

create or replace function public.obtener_rrhh_estado_actual_usuario()
returns table (
  profile_id uuid,
  estado_codigo text,
  estado_nombre text,
  registrado_at timestamptz,
  fecha date,
  duracion_minutos integer,
  puede_registrar boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_puede_registrar boolean;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  v_puede_registrar := public.current_user_has_permission('hr.timesheets.register');

  return query
  select
    v_user_id,
    e.estado_codigo,
    e.estado_nombre,
    e.registrado_at,
    e.fecha,
    floor(extract(epoch from (now() - e.registrado_at)) / 60)::integer,
    v_puede_registrar
  from public.rrhh_planilla_eventos as e
  where e.empresa_id = v_empresa_id
    and e.profile_id = v_user_id
  order by e.registrado_at desc
  limit 1;

  if not found then
    return query select v_user_id, null::text, null::text, null::timestamptz, current_date, null::integer, v_puede_registrar;
  end if;
end;
$$;

create or replace function public.obtener_rrhh_planilla_dashboard(
  p_fecha date default current_date
)
returns table (
  profile_id uuid,
  nombre text,
  correo text,
  estado_actual text,
  desde timestamptz,
  minutos_en_estado integer,
  primer_login timestamptz,
  ultima_salida timestamptz,
  cantidad_eventos integer,
  alerta text
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
    public.current_user_has_permission('hr.timesheets.dashboard')
    or public.current_user_has_permission('hr.timesheets.view')
    or public.current_user_has_permission('hr.timesheets.manage')
  ) then
    raise exception 'Permiso hr.timesheets.dashboard requerido.' using errcode = '42501';
  end if;

  return query
  with eventos_dia as (
    select e.*
    from public.rrhh_planilla_eventos as e
    where e.empresa_id = v_empresa_id
      and e.fecha = coalesce(p_fecha, current_date)
  ),
  ultimos as (
    select distinct on (e.profile_id)
      e.profile_id,
      e.estado_nombre,
      e.registrado_at,
      e.estado_codigo
    from eventos_dia as e
    order by e.profile_id, e.registrado_at desc
  ),
  agregados as (
    select
      e.profile_id,
      min(e.registrado_at) filter (where e.estado_codigo = 'login') as primer_login,
      max(e.registrado_at) filter (where e.estado_codigo = 'salida') as ultima_salida,
      count(*)::integer as cantidad_eventos
    from eventos_dia as e
    group by e.profile_id
  )
  select
    p.id,
    p.nombre,
    p.correo,
    coalesce(u.estado_nombre, 'Sin estado'),
    u.registrado_at,
    case when u.registrado_at is null
      then null
      else floor(extract(epoch from (now() - u.registrado_at)) / 60)::integer
    end,
    a.primer_login,
    a.ultima_salida,
    coalesce(a.cantidad_eventos, 0),
    case
      when a.primer_login is null then 'Sin login'
      when u.estado_codigo in ('almuerzo', 'pausa', 'break_1', 'break_2')
        and u.registrado_at < now() - interval '90 minutes' then 'Pausa prolongada'
      when u.estado_codigo = 'salida' then 'Jornada cerrada'
      else null
    end
  from public.profiles as p
  left join ultimos as u on u.profile_id = p.id
  left join agregados as a on a.profile_id = p.id
  where p.empresa_id = v_empresa_id
    and p.estado = 'activo'
  order by p.nombre;
end;
$$;

create or replace function public.crear_rrhh_planilla_estado(
  p_codigo text,
  p_nombre text,
  p_tipo text,
  p_color text default null,
  p_orden integer default 0,
  p_requiere_regreso boolean default false,
  p_estado_regreso_codigo text default null,
  p_cuenta_como_trabajo boolean default false,
  p_cuenta_como_pausa boolean default false
)
returns table (estado_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_estado public.rrhh_planilla_estados%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('hr.timesheets.states.manage') then
    raise exception 'Permiso hr.timesheets.states.manage requerido.' using errcode = '42501';
  end if;

  insert into public.rrhh_planilla_estados (
    empresa_id, codigo, nombre, tipo, color, orden, requiere_regreso,
    estado_regreso_codigo, cuenta_como_trabajo, cuenta_como_pausa,
    es_sistema, creado_por, actualizado_por
  )
  values (
    v_empresa_id,
    lower(btrim(p_codigo)),
    btrim(p_nombre),
    p_tipo,
    nullif(btrim(coalesce(p_color, '')), ''),
    coalesce(p_orden, 0),
    coalesce(p_requiere_regreso, false),
    nullif(lower(btrim(coalesce(p_estado_regreso_codigo, ''))), ''),
    coalesce(p_cuenta_como_trabajo, false),
    coalesce(p_cuenta_como_pausa, false),
    false,
    v_user_id,
    v_user_id
  )
  returning * into v_estado;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_estados',
    v_estado.id,
    'crear_rrhh_planilla_estado',
    to_jsonb(v_estado)
  );

  return query select v_estado.id;
end;
$$;

create or replace function public.actualizar_rrhh_planilla_estado(
  p_estado_id uuid,
  p_codigo text,
  p_nombre text,
  p_tipo text,
  p_color text default null,
  p_orden integer default 0,
  p_requiere_regreso boolean default false,
  p_estado_regreso_codigo text default null,
  p_cuenta_como_trabajo boolean default false,
  p_cuenta_como_pausa boolean default false
)
returns table (estado_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.rrhh_planilla_estados%rowtype;
  v_despues public.rrhh_planilla_estados%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('hr.timesheets.states.manage') then
    raise exception 'Permiso hr.timesheets.states.manage requerido.' using errcode = '42501';
  end if;

  select e.* into v_antes
  from public.rrhh_planilla_estados as e
  where e.id = p_estado_id
    and e.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Estado no encontrado.' using errcode = '02000';
  end if;

  update public.rrhh_planilla_estados as e
  set codigo = case when e.es_sistema then e.codigo else lower(btrim(p_codigo)) end,
      nombre = btrim(p_nombre),
      tipo = p_tipo,
      color = nullif(btrim(coalesce(p_color, '')), ''),
      orden = coalesce(p_orden, 0),
      requiere_regreso = coalesce(p_requiere_regreso, false),
      estado_regreso_codigo = nullif(lower(btrim(coalesce(p_estado_regreso_codigo, ''))), ''),
      cuenta_como_trabajo = coalesce(p_cuenta_como_trabajo, false),
      cuenta_como_pausa = coalesce(p_cuenta_como_pausa, false),
      actualizado_por = v_user_id
  where e.id = p_estado_id
    and e.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_estados',
    v_despues.id,
    'actualizar_rrhh_planilla_estado',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id;
end;
$$;

create or replace function public.cambiar_estado_rrhh_planilla_estado(
  p_estado_id uuid,
  p_activo boolean
)
returns table (estado_id uuid, activo boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.rrhh_planilla_estados%rowtype;
  v_despues public.rrhh_planilla_estados%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('hr.timesheets.states.manage') then
    raise exception 'Permiso hr.timesheets.states.manage requerido.' using errcode = '42501';
  end if;

  select e.* into v_antes
  from public.rrhh_planilla_estados as e
  where e.id = p_estado_id
    and e.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Estado no encontrado.' using errcode = '02000';
  end if;

  update public.rrhh_planilla_estados as e
  set activo = coalesce(p_activo, false),
      actualizado_por = v_user_id
  where e.id = p_estado_id
    and e.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_estados',
    v_despues.id,
    'cambiar_estado_rrhh_planilla_estado',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.activo;
end;
$$;

revoke all on function public.inicializar_rrhh_planilla_estados_empresa() from public;
revoke all on function public.registrar_rrhh_planilla_estado(text, text) from public;
revoke all on function public.obtener_rrhh_estado_actual_usuario() from public;
revoke all on function public.obtener_rrhh_planilla_dashboard(date) from public;
revoke all on function public.crear_rrhh_planilla_estado(text, text, text, text, integer, boolean, text, boolean, boolean) from public;
revoke all on function public.actualizar_rrhh_planilla_estado(uuid, text, text, text, text, integer, boolean, text, boolean, boolean) from public;
revoke all on function public.cambiar_estado_rrhh_planilla_estado(uuid, boolean) from public;

grant execute on function public.inicializar_rrhh_planilla_estados_empresa() to authenticated;
grant execute on function public.registrar_rrhh_planilla_estado(text, text) to authenticated;
grant execute on function public.obtener_rrhh_estado_actual_usuario() to authenticated;
grant execute on function public.obtener_rrhh_planilla_dashboard(date) to authenticated;
grant execute on function public.crear_rrhh_planilla_estado(text, text, text, text, integer, boolean, text, boolean, boolean) to authenticated;
grant execute on function public.actualizar_rrhh_planilla_estado(uuid, text, text, text, text, integer, boolean, text, boolean, boolean) to authenticated;
grant execute on function public.cambiar_estado_rrhh_planilla_estado(uuid, boolean) to authenticated;
