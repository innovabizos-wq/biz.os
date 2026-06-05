-- Adds customer gender for CRM analytics.
-- Apply manually in Supabase SQL Editor after previous migrations.

alter table public.crm_clientes
  add column if not exists genero text not null default 'o';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_clientes_genero_check'
      and conrelid = 'public.crm_clientes'::regclass
  ) then
    alter table public.crm_clientes
      add constraint crm_clientes_genero_check
      check (genero in ('h', 'm', 'o'));
  end if;
end $$;

drop function if exists public.crear_crm_cliente(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
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
  p_notas text default null,
  p_genero text default 'o'
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

  if coalesce(nullif(trim(p_genero), ''), 'o') not in ('h', 'm', 'o') then
    raise exception 'Genero de cliente invalido.' using errcode = '22023';
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
    genero,
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
    coalesce(nullif(trim(p_genero), ''), 'o'),
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

drop function if exists public.actualizar_crm_cliente(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  text
);

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
  p_notas text default null,
  p_genero text default 'o'
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

  if coalesce(nullif(trim(p_genero), ''), 'o') not in ('h', 'm', 'o') then
    raise exception 'Genero de cliente invalido.' using errcode = '22023';
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
    genero = coalesce(nullif(trim(p_genero), ''), 'o'),
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

revoke all on function public.crear_crm_cliente(text, text, text, text, text, text, text, uuid, text, text) from public;
revoke all on function public.actualizar_crm_cliente(uuid, text, text, text, text, text, text, text, text, uuid, text, text) from public;

grant execute on function public.crear_crm_cliente(text, text, text, text, text, text, text, uuid, text, text) to authenticated;
grant execute on function public.actualizar_crm_cliente(uuid, text, text, text, text, text, text, text, text, uuid, text, text) to authenticated;
