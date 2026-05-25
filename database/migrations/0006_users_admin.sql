-- biz.os user administration RPCs.
-- Apply manually in Supabase SQL Editor after 0005.

create policy profiles_select_users_admin
on public.profiles
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.users.view')
    or public.current_user_has_permission('admin.users.manage')
  )
);

create or replace function public.actualizar_usuario_empresa(
  p_profile_id uuid,
  p_nombre text,
  p_telefono text default null
)
returns table (
  profile_id uuid,
  nombre text,
  telefono text,
  estado text,
  rol_id uuid,
  sucursal_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_nombre text := trim(p_nombre);
  v_antes public.profiles%rowtype;
  v_despues public.profiles%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'Permiso admin.users.manage requerido.'
      using errcode = '42501';
  end if;

  if nullif(v_nombre, '') is null then
    raise exception 'Nombre de usuario requerido.'
      using errcode = '22023';
  end if;

  select pr.*
  into v_antes
  from public.profiles as pr
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Usuario no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  update public.profiles as pr
  set
    nombre = v_nombre,
    telefono = nullif(trim(p_telefono), '')
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id
  returning pr.* into v_despues;

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
    'profiles',
    p_profile_id,
    'actualizar_usuario_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.telefono,
    v_despues.estado,
    v_despues.rol_id,
    v_despues.sucursal_id;
end;
$$;

create or replace function public.cambiar_rol_usuario_empresa(
  p_profile_id uuid,
  p_rol_id uuid
)
returns table (
  profile_id uuid,
  nombre text,
  telefono text,
  estado text,
  rol_id uuid,
  sucursal_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.profiles%rowtype;
  v_despues public.profiles%rowtype;
  v_new_role_has_users_manage boolean := false;
  v_new_role_has_roles_manage boolean := false;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'Permiso admin.users.manage requerido.'
      using errcode = '42501';
  end if;

  select pr.*
  into v_antes
  from public.profiles as pr
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Usuario no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  if not exists (
    select 1
    from public.roles as r
    where r.id = p_rol_id
      and r.empresa_id = v_empresa_id
      and r.estado = 'activo'
  ) then
    raise exception 'Rol activo no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  if p_profile_id = v_user_id then
    select exists (
      select 1
      from public.rol_permisos as rp
      join public.permisos as p on p.id = rp.permiso_id
      where rp.empresa_id = v_empresa_id
        and rp.rol_id = p_rol_id
        and p.codigo = 'admin.users.manage'
        and p.estado = 'activo'
    )
    into v_new_role_has_users_manage;

    select exists (
      select 1
      from public.rol_permisos as rp
      join public.permisos as p on p.id = rp.permiso_id
      where rp.empresa_id = v_empresa_id
        and rp.rol_id = p_rol_id
        and p.codigo = 'admin.roles.manage'
        and p.estado = 'activo'
    )
    into v_new_role_has_roles_manage;

    if not v_new_role_has_users_manage or not v_new_role_has_roles_manage then
      raise exception 'No puedes cambiar tu rol a uno sin permisos administrativos.'
        using errcode = '42501';
    end if;
  end if;

  update public.profiles as pr
  set rol_id = p_rol_id
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id
  returning pr.* into v_despues;

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
    'profiles',
    p_profile_id,
    'cambiar_rol_usuario_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.telefono,
    v_despues.estado,
    v_despues.rol_id,
    v_despues.sucursal_id;
end;
$$;

create or replace function public.cambiar_sucursal_usuario_empresa(
  p_profile_id uuid,
  p_sucursal_id uuid default null
)
returns table (
  profile_id uuid,
  nombre text,
  telefono text,
  estado text,
  rol_id uuid,
  sucursal_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.profiles%rowtype;
  v_despues public.profiles%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'Permiso admin.users.manage requerido.'
      using errcode = '42501';
  end if;

  select pr.*
  into v_antes
  from public.profiles as pr
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Usuario no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  if p_sucursal_id is not null
    and not exists (
      select 1
      from public.sucursales as s
      where s.id = p_sucursal_id
        and s.empresa_id = v_empresa_id
        and s.estado = 'activa'
    ) then
    raise exception 'Sucursal activa no encontrada en la empresa actual.'
      using errcode = '02000';
  end if;

  update public.profiles as pr
  set sucursal_id = p_sucursal_id
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id
  returning pr.* into v_despues;

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
    'profiles',
    p_profile_id,
    'cambiar_sucursal_usuario_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.telefono,
    v_despues.estado,
    v_despues.rol_id,
    v_despues.sucursal_id;
end;
$$;

create or replace function public.cambiar_estado_usuario_empresa(
  p_profile_id uuid,
  p_estado text
)
returns table (
  profile_id uuid,
  nombre text,
  telefono text,
  estado text,
  rol_id uuid,
  sucursal_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.profiles%rowtype;
  v_despues public.profiles%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if p_estado not in ('activo', 'inactivo', 'suspendido') then
    raise exception 'Estado de usuario invalido.'
      using errcode = '22023';
  end if;

  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'Permiso admin.users.manage requerido.'
      using errcode = '42501';
  end if;

  if p_profile_id = v_user_id and p_estado <> 'activo' then
    raise exception 'No puedes inactivar o suspender tu propio usuario.'
      using errcode = '42501';
  end if;

  select pr.*
  into v_antes
  from public.profiles as pr
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Usuario no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  update public.profiles as pr
  set estado = p_estado
  where pr.id = p_profile_id
    and pr.empresa_id = v_empresa_id
  returning pr.* into v_despues;

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
    'profiles',
    p_profile_id,
    'cambiar_estado_usuario_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.telefono,
    v_despues.estado,
    v_despues.rol_id,
    v_despues.sucursal_id;
end;
$$;

revoke all on function public.actualizar_usuario_empresa(uuid, text, text)
  from public;
revoke all on function public.cambiar_rol_usuario_empresa(uuid, uuid)
  from public;
revoke all on function public.cambiar_sucursal_usuario_empresa(uuid, uuid)
  from public;
revoke all on function public.cambiar_estado_usuario_empresa(uuid, text)
  from public;

grant execute on function public.actualizar_usuario_empresa(uuid, text, text)
  to authenticated;
grant execute on function public.cambiar_rol_usuario_empresa(uuid, uuid)
  to authenticated;
grant execute on function public.cambiar_sucursal_usuario_empresa(uuid, uuid)
  to authenticated;
grant execute on function public.cambiar_estado_usuario_empresa(uuid, text)
  to authenticated;
