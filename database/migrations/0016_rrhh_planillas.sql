-- biz.os basic HR timesheet events.
-- Apply manually in Supabase SQL Editor after 0015.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values
  ('hr', 'RRHH', 'Planillas, asistencia y estados diarios.', 'activo', 70)
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    estado = excluded.estado,
    orden = excluded.orden;

insert into public.empresa_modulos (empresa_id, modulo_id)
select e.id, m.id
from public.empresas as e
join public.modulos as m on m.codigo = 'hr'
where m.estado = 'activo'
on conflict on constraint empresa_modulos_empresa_modulo_unique
do nothing;

create table public.rrhh_planilla_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null,
  estado text not null,
  nota text,
  registrado_at timestamptz not null default now(),
  creado_por uuid,
  created_at timestamptz not null default now(),

  constraint rrhh_planilla_eventos_estado_check
    check (estado in ('login', 'disponible', 'almuerzo_inicio', 'almuerzo_fin', 'pausa_inicio', 'pausa_fin', 'logout')),
  constraint rrhh_planilla_eventos_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint rrhh_planilla_eventos_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por)
);

create index rrhh_planilla_eventos_empresa_id_idx
  on public.rrhh_planilla_eventos (empresa_id);
create index rrhh_planilla_eventos_empresa_profile_idx
  on public.rrhh_planilla_eventos (empresa_id, profile_id);
create index rrhh_planilla_eventos_empresa_registrado_idx
  on public.rrhh_planilla_eventos (empresa_id, registrado_at desc);

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('hr.timesheets.view', 'Ver planillas', 'Permite consultar planillas de RRHH.', 'hr', 'activo'),
  ('hr.timesheets.create', 'Registrar estados de planilla', 'Permite alimentar planillas con estados diarios.', 'hr', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in ('hr.timesheets.view', 'hr.timesheets.create')
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.rrhh_planilla_eventos enable row level security;

grant select on public.rrhh_planilla_eventos to authenticated;

create policy rrhh_planilla_eventos_select_permission
on public.rrhh_planilla_eventos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('hr.timesheets.view')
    or (
      public.current_user_has_permission('hr.timesheets.create')
      and profile_id = auth.uid()
    )
  )
);

create or replace function public.registrar_rrhh_planilla_estado(
  p_estado text,
  p_nota text default null
)
returns table (evento_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_evento public.rrhh_planilla_eventos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('hr.timesheets.create') then
    raise exception 'Permiso hr.timesheets.create requerido.' using errcode = '42501';
  end if;

  if p_estado not in ('login', 'disponible', 'almuerzo_inicio', 'almuerzo_fin', 'pausa_inicio', 'pausa_fin', 'logout') then
    raise exception 'Estado de planilla invalido.' using errcode = '22023';
  end if;

  insert into public.rrhh_planilla_eventos (
    empresa_id,
    profile_id,
    estado,
    nota,
    creado_por
  )
  values (
    v_empresa_id,
    v_user_id,
    p_estado,
    nullif(btrim(coalesce(p_nota, '')), ''),
    v_user_id
  )
  returning * into v_evento;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'rrhh_planilla_eventos',
    v_evento.id,
    'registrar_rrhh_planilla_estado',
    to_jsonb(v_evento)
  );

  return query select v_evento.id;
end;
$$;

revoke all on function public.registrar_rrhh_planilla_estado(text, text) from public;
grant execute on function public.registrar_rrhh_planilla_estado(text, text) to authenticated;
