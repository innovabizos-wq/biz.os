-- biz.os basic CRM core.
-- Apply manually in Supabase SQL Editor after 0006.

create table public.crm_clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null default 'prospecto',
  estado text not null default 'nuevo',
  nombre text not null,
  identificacion text,
  telefono text,
  whatsapp text,
  correo text,
  origen text,
  asignado_a uuid,
  notas text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_clientes_tipo_check
    check (tipo in ('prospecto', 'cliente')),
  constraint crm_clientes_estado_check
    check (
      estado in (
        'nuevo',
        'contactado',
        'calificado',
        'cotizado',
        'ganado',
        'perdido',
        'inactivo'
      )
    ),
  constraint crm_clientes_id_empresa_unique
    unique (id, empresa_id),
  constraint crm_clientes_asignado_empresa_fkey
    foreign key (asignado_a, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (asignado_a),
  constraint crm_clientes_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint crm_clientes_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index crm_clientes_empresa_id_idx on public.crm_clientes (empresa_id);
create index crm_clientes_empresa_estado_idx
  on public.crm_clientes (empresa_id, estado);
create index crm_clientes_empresa_tipo_idx
  on public.crm_clientes (empresa_id, tipo);
create index crm_clientes_empresa_asignado_idx
  on public.crm_clientes (empresa_id, asignado_a);
create index crm_clientes_empresa_created_at_idx
  on public.crm_clientes (empresa_id, created_at);

create trigger set_crm_clientes_updated_at
before update on public.crm_clientes
for each row execute function public.set_updated_at();

create table public.crm_interacciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null,
  tipo text not null default 'nota',
  resultado text,
  resumen text not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint crm_interacciones_tipo_check
    check (tipo in ('nota', 'llamada', 'whatsapp', 'correo', 'reunion', 'sistema')),
  constraint crm_interacciones_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete cascade,
  constraint crm_interacciones_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index crm_interacciones_empresa_id_idx
  on public.crm_interacciones (empresa_id);
create index crm_interacciones_empresa_cliente_idx
  on public.crm_interacciones (empresa_id, cliente_id);
create index crm_interacciones_empresa_created_at_idx
  on public.crm_interacciones (empresa_id, created_at);

create table public.crm_seguimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid not null,
  asignado_a uuid,
  asunto text not null,
  descripcion text,
  fecha_programada timestamptz not null,
  estado text not null default 'pendiente',
  completado_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint crm_seguimientos_estado_check
    check (estado in ('pendiente', 'completado', 'cancelado')),
  constraint crm_seguimientos_completado_check
    check (estado <> 'completado' or completado_at is not null),
  constraint crm_seguimientos_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete cascade,
  constraint crm_seguimientos_asignado_empresa_fkey
    foreign key (asignado_a, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (asignado_a),
  constraint crm_seguimientos_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint crm_seguimientos_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index crm_seguimientos_empresa_id_idx
  on public.crm_seguimientos (empresa_id);
create index crm_seguimientos_empresa_cliente_idx
  on public.crm_seguimientos (empresa_id, cliente_id);
create index crm_seguimientos_empresa_asignado_idx
  on public.crm_seguimientos (empresa_id, asignado_a);
create index crm_seguimientos_empresa_estado_idx
  on public.crm_seguimientos (empresa_id, estado);
create index crm_seguimientos_empresa_fecha_idx
  on public.crm_seguimientos (empresa_id, fecha_programada);

create trigger set_crm_seguimientos_updated_at
before update on public.crm_seguimientos
for each row execute function public.set_updated_at();

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('crm.customers.edit', 'Editar clientes CRM', 'Permite editar clientes y prospectos.', 'crm', 'activo'),
  ('crm.interactions.view', 'Ver interacciones CRM', 'Permite ver interacciones registradas.', 'crm', 'activo'),
  ('crm.interactions.create', 'Crear interacciones CRM', 'Permite registrar interacciones manuales.', 'crm', 'activo'),
  ('crm.followups.view', 'Ver seguimientos CRM', 'Permite ver seguimientos comerciales.', 'crm', 'activo'),
  ('crm.followups.create', 'Crear seguimientos CRM', 'Permite crear seguimientos comerciales.', 'crm', 'activo'),
  ('crm.followups.edit', 'Editar seguimientos CRM', 'Permite cambiar estado de seguimientos.', 'crm', 'activo')
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'crm.customers.view',
    'crm.customers.create',
    'crm.customers.edit',
    'crm.interactions.view',
    'crm.interactions.create',
    'crm.followups.view',
    'crm.followups.create',
    'crm.followups.edit'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.crm_clientes enable row level security;
alter table public.crm_interacciones enable row level security;
alter table public.crm_seguimientos enable row level security;

grant select on public.crm_clientes to authenticated;
grant select on public.crm_interacciones to authenticated;
grant select on public.crm_seguimientos to authenticated;

create policy crm_clientes_select_permission
on public.crm_clientes
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('crm.customers.view')
    or public.current_user_has_permission('crm.customers.create')
    or public.current_user_has_permission('crm.customers.edit')
  )
);

create policy crm_interacciones_select_permission
on public.crm_interacciones
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('crm.interactions.view')
    or public.current_user_has_permission('crm.interactions.create')
  )
);

create policy crm_seguimientos_select_permission
on public.crm_seguimientos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('crm.followups.view')
    or public.current_user_has_permission('crm.followups.create')
    or public.current_user_has_permission('crm.followups.edit')
  )
);

create or replace function public.crear_crm_cliente(
  p_tipo text,
  p_nombre text,
  p_identificacion text default null,
  p_telefono text default null,
  p_whatsapp text default null,
  p_correo text default null,
  p_origen text default null,
  p_asignado_a uuid default null,
  p_notas text default null
)
returns table (
  cliente_id uuid,
  tipo text,
  estado text,
  nombre text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cliente public.crm_clientes%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('crm.customers.create') then
    raise exception 'Permiso crm.customers.create requerido.' using errcode = '42501';
  end if;

  if p_tipo not in ('prospecto', 'cliente') then
    raise exception 'Tipo de cliente invalido.' using errcode = '22023';
  end if;

  if nullif(trim(p_nombre), '') is null then
    raise exception 'Nombre de cliente requerido.' using errcode = '22023';
  end if;

  if p_asignado_a is not null
    and not exists (
      select 1
      from public.profiles as pr
      where pr.id = p_asignado_a
        and pr.empresa_id = v_empresa_id
        and pr.estado = 'activo'
    ) then
    raise exception 'Usuario asignado invalido para la empresa actual.' using errcode = '23503';
  end if;

  insert into public.crm_clientes (
    empresa_id,
    tipo,
    estado,
    nombre,
    identificacion,
    telefono,
    whatsapp,
    correo,
    origen,
    asignado_a,
    notas,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_tipo,
    'nuevo',
    trim(p_nombre),
    nullif(trim(p_identificacion), ''),
    nullif(trim(p_telefono), ''),
    nullif(trim(p_whatsapp), ''),
    nullif(trim(p_correo), ''),
    nullif(trim(p_origen), ''),
    p_asignado_a,
    nullif(trim(p_notas), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_cliente;

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
    'crm_clientes',
    v_cliente.id,
    'crear_crm_cliente',
    to_jsonb(v_cliente)
  );

  return query
  select v_cliente.id, v_cliente.tipo, v_cliente.estado, v_cliente.nombre;
end;
$$;

create or replace function public.actualizar_crm_cliente(
  p_cliente_id uuid,
  p_tipo text,
  p_estado text,
  p_nombre text,
  p_identificacion text default null,
  p_telefono text default null,
  p_whatsapp text default null,
  p_correo text default null,
  p_origen text default null,
  p_asignado_a uuid default null,
  p_notas text default null
)
returns table (
  cliente_id uuid,
  tipo text,
  estado text,
  nombre text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.crm_clientes%rowtype;
  v_despues public.crm_clientes%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('crm.customers.edit') then
    raise exception 'Permiso crm.customers.edit requerido.' using errcode = '42501';
  end if;

  if p_tipo not in ('prospecto', 'cliente') then
    raise exception 'Tipo de cliente invalido.' using errcode = '22023';
  end if;

  if p_estado not in ('nuevo', 'contactado', 'calificado', 'cotizado', 'ganado', 'perdido', 'inactivo') then
    raise exception 'Estado de cliente invalido.' using errcode = '22023';
  end if;

  if nullif(trim(p_nombre), '') is null then
    raise exception 'Nombre de cliente requerido.' using errcode = '22023';
  end if;

  select c.*
  into v_antes
  from public.crm_clientes as c
  where c.id = p_cliente_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  if p_asignado_a is not null
    and not exists (
      select 1
      from public.profiles as pr
      where pr.id = p_asignado_a
        and pr.empresa_id = v_empresa_id
        and pr.estado = 'activo'
    ) then
    raise exception 'Usuario asignado invalido para la empresa actual.' using errcode = '23503';
  end if;

  update public.crm_clientes as c
  set
    tipo = p_tipo,
    estado = p_estado,
    nombre = trim(p_nombre),
    identificacion = nullif(trim(p_identificacion), ''),
    telefono = nullif(trim(p_telefono), ''),
    whatsapp = nullif(trim(p_whatsapp), ''),
    correo = nullif(trim(p_correo), ''),
    origen = nullif(trim(p_origen), ''),
    asignado_a = p_asignado_a,
    notas = nullif(trim(p_notas), ''),
    updated_by = v_user_id
  where c.id = p_cliente_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'crm_clientes',
    p_cliente_id,
    'actualizar_crm_cliente',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select v_despues.id, v_despues.tipo, v_despues.estado, v_despues.nombre;
end;
$$;

create or replace function public.crear_crm_interaccion(
  p_cliente_id uuid,
  p_tipo text,
  p_resultado text default null,
  p_resumen text default null
)
returns table (
  interaccion_id uuid,
  cliente_id uuid,
  tipo text,
  resumen text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_interaccion public.crm_interacciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('crm.interactions.create') then
    raise exception 'Permiso crm.interactions.create requerido.' using errcode = '42501';
  end if;

  if p_tipo not in ('nota', 'llamada', 'whatsapp', 'correo', 'reunion', 'sistema') then
    raise exception 'Tipo de interaccion invalido.' using errcode = '22023';
  end if;

  if nullif(trim(p_resumen), '') is null then
    raise exception 'Resumen requerido.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.crm_clientes as c
    where c.id = p_cliente_id
      and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  insert into public.crm_interacciones (
    empresa_id,
    cliente_id,
    tipo,
    resultado,
    resumen,
    created_by
  )
  values (
    v_empresa_id,
    p_cliente_id,
    p_tipo,
    nullif(trim(p_resultado), ''),
    trim(p_resumen),
    v_user_id
  )
  returning * into v_interaccion;

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
    'crm_interacciones',
    v_interaccion.id,
    'crear_crm_interaccion',
    to_jsonb(v_interaccion)
  );

  return query
  select v_interaccion.id, v_interaccion.cliente_id, v_interaccion.tipo, v_interaccion.resumen;
end;
$$;

create or replace function public.crear_crm_seguimiento(
  p_cliente_id uuid,
  p_asignado_a uuid default null,
  p_asunto text default null,
  p_descripcion text default null,
  p_fecha_programada timestamptz default null
)
returns table (
  seguimiento_id uuid,
  cliente_id uuid,
  estado text,
  asunto text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_seguimiento public.crm_seguimientos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('crm.followups.create') then
    raise exception 'Permiso crm.followups.create requerido.' using errcode = '42501';
  end if;

  if nullif(trim(p_asunto), '') is null then
    raise exception 'Asunto requerido.' using errcode = '22023';
  end if;

  if p_fecha_programada is null then
    raise exception 'Fecha programada requerida.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.crm_clientes as c
    where c.id = p_cliente_id
      and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  if p_asignado_a is not null
    and not exists (
      select 1
      from public.profiles as pr
      where pr.id = p_asignado_a
        and pr.empresa_id = v_empresa_id
        and pr.estado = 'activo'
    ) then
    raise exception 'Usuario asignado invalido para la empresa actual.' using errcode = '23503';
  end if;

  insert into public.crm_seguimientos (
    empresa_id,
    cliente_id,
    asignado_a,
    asunto,
    descripcion,
    fecha_programada,
    estado,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_cliente_id,
    p_asignado_a,
    trim(p_asunto),
    nullif(trim(p_descripcion), ''),
    p_fecha_programada,
    'pendiente',
    v_user_id,
    v_user_id
  )
  returning * into v_seguimiento;

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
    'crm_seguimientos',
    v_seguimiento.id,
    'crear_crm_seguimiento',
    to_jsonb(v_seguimiento)
  );

  return query
  select v_seguimiento.id, v_seguimiento.cliente_id, v_seguimiento.estado, v_seguimiento.asunto;
end;
$$;

create or replace function public.cambiar_estado_crm_seguimiento(
  p_seguimiento_id uuid,
  p_estado text
)
returns table (
  seguimiento_id uuid,
  cliente_id uuid,
  estado text,
  asunto text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.crm_seguimientos%rowtype;
  v_despues public.crm_seguimientos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('pendiente', 'completado', 'cancelado') then
    raise exception 'Estado de seguimiento invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('crm.followups.edit') then
    raise exception 'Permiso crm.followups.edit requerido.' using errcode = '42501';
  end if;

  select s.*
  into v_antes
  from public.crm_seguimientos as s
  where s.id = p_seguimiento_id
    and s.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Seguimiento CRM no encontrado.' using errcode = '02000';
  end if;

  update public.crm_seguimientos as s
  set
    estado = p_estado,
    completado_at = case when p_estado = 'completado' then now() else null end,
    updated_by = v_user_id
  where s.id = p_seguimiento_id
    and s.empresa_id = v_empresa_id
  returning s.* into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'crm_seguimientos',
    p_seguimiento_id,
    'cambiar_estado_crm_seguimiento',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select v_despues.id, v_despues.cliente_id, v_despues.estado, v_despues.asunto;
end;
$$;

revoke all on function public.crear_crm_cliente(text, text, text, text, text, text, text, uuid, text) from public;
revoke all on function public.actualizar_crm_cliente(uuid, text, text, text, text, text, text, text, text, uuid, text) from public;
revoke all on function public.crear_crm_interaccion(uuid, text, text, text) from public;
revoke all on function public.crear_crm_seguimiento(uuid, uuid, text, text, timestamptz) from public;
revoke all on function public.cambiar_estado_crm_seguimiento(uuid, text) from public;

grant execute on function public.crear_crm_cliente(text, text, text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.actualizar_crm_cliente(uuid, text, text, text, text, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.crear_crm_interaccion(uuid, text, text, text) to authenticated;
grant execute on function public.crear_crm_seguimiento(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.cambiar_estado_crm_seguimiento(uuid, text) to authenticated;
