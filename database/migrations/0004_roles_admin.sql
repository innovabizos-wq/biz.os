-- biz.os role administration RPCs.
-- Apply manually in Supabase SQL Editor after 0001, 0002 and 0003.

create policy rol_permisos_select_roles_admin
on public.rol_permisos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.roles.view')
    or public.current_user_has_permission('admin.roles.manage')
  )
);

create or replace function public.crear_rol_empresa(
  p_nombre text,
  p_descripcion text default null
)
returns table (
  rol_id uuid,
  nombre text,
  descripcion text,
  estado text,
  es_sistema boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_nombre text := trim(p_nombre);
  v_rol public.roles%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.roles.manage') then
    raise exception 'Permiso admin.roles.manage requerido.'
      using errcode = '42501';
  end if;

  if nullif(v_nombre, '') is null then
    raise exception 'Nombre de rol requerido.'
      using errcode = '22023';
  end if;

  insert into public.roles (
    empresa_id,
    nombre,
    descripcion,
    es_sistema,
    estado
  )
  values (
    v_empresa_id,
    v_nombre,
    nullif(trim(p_descripcion), ''),
    false,
    'activo'
  )
  returning * into v_rol;

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
    'roles',
    v_rol.id,
    'crear_rol_empresa',
    to_jsonb(v_rol)
  );

  return query
  select v_rol.id, v_rol.nombre, v_rol.descripcion, v_rol.estado, v_rol.es_sistema;
end;
$$;

create or replace function public.actualizar_rol_empresa(
  p_rol_id uuid,
  p_nombre text,
  p_descripcion text default null
)
returns table (
  rol_id uuid,
  nombre text,
  descripcion text,
  estado text,
  es_sistema boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_nombre text := trim(p_nombre);
  v_antes public.roles%rowtype;
  v_despues public.roles%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.roles.manage') then
    raise exception 'Permiso admin.roles.manage requerido.'
      using errcode = '42501';
  end if;

  if nullif(v_nombre, '') is null then
    raise exception 'Nombre de rol requerido.'
      using errcode = '22023';
  end if;

  select *
  into v_antes
  from public.roles as r
  where r.id = p_rol_id
    and r.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Rol no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  update public.roles
  set
    nombre = v_nombre,
    descripcion = nullif(trim(p_descripcion), '')
  where id = p_rol_id
    and empresa_id = v_empresa_id
  returning * into v_despues;

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
    'roles',
    p_rol_id,
    'actualizar_rol_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.descripcion,
    v_despues.estado,
    v_despues.es_sistema;
end;
$$;

create or replace function public.cambiar_estado_rol_empresa(
  p_rol_id uuid,
  p_estado text
)
returns table (
  rol_id uuid,
  nombre text,
  descripcion text,
  estado text,
  es_sistema boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_current_rol_id uuid;
  v_antes public.roles%rowtype;
  v_despues public.roles%rowtype;
  v_target_has_manage boolean := false;
  v_other_manage_roles integer := 0;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if p_estado not in ('activo', 'inactivo') then
    raise exception 'Estado de rol invalido.'
      using errcode = '22023';
  end if;

  if not public.current_user_has_permission('admin.roles.manage') then
    raise exception 'Permiso admin.roles.manage requerido.'
      using errcode = '42501';
  end if;

  select p.rol_id
  into v_current_rol_id
  from public.profiles as p
  where p.id = v_user_id
    and p.empresa_id = v_empresa_id
    and p.estado = 'activo';

  select *
  into v_antes
  from public.roles as r
  where r.id = p_rol_id
    and r.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Rol no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  if p_estado = 'inactivo' and p_rol_id = v_current_rol_id then
    raise exception 'No puedes inactivar tu rol actual.'
      using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.rol_permisos as rp
    join public.permisos as perm on perm.id = rp.permiso_id
    where rp.empresa_id = v_empresa_id
      and rp.rol_id = p_rol_id
      and perm.codigo = 'admin.roles.manage'
      and perm.estado = 'activo'
  )
  into v_target_has_manage;

  if p_estado = 'inactivo' and v_target_has_manage then
    select count(*)
    into v_other_manage_roles
    from public.roles as r
    join public.rol_permisos as rp
      on rp.empresa_id = r.empresa_id
      and rp.rol_id = r.id
    join public.permisos as perm on perm.id = rp.permiso_id
    where r.empresa_id = v_empresa_id
      and r.id <> p_rol_id
      and r.estado = 'activo'
      and perm.codigo = 'admin.roles.manage'
      and perm.estado = 'activo';

    if v_other_manage_roles = 0 then
      raise exception 'Debe existir al menos un rol activo con admin.roles.manage.'
        using errcode = '42501';
    end if;
  end if;

  update public.roles
  set estado = p_estado
  where id = p_rol_id
    and empresa_id = v_empresa_id
  returning * into v_despues;

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
    'roles',
    p_rol_id,
    'cambiar_estado_rol_empresa',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.nombre,
    v_despues.descripcion,
    v_despues.estado,
    v_despues.es_sistema;
end;
$$;

create or replace function public.asignar_permiso_rol(
  p_rol_id uuid,
  p_permiso_codigo text
)
returns table (
  rol_id uuid,
  permiso_codigo text,
  assigned boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_permiso_id uuid;
  v_inserted integer := 0;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.roles.manage') then
    raise exception 'Permiso admin.roles.manage requerido.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.roles as r
    where r.id = p_rol_id
      and r.empresa_id = v_empresa_id
  ) then
    raise exception 'Rol no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  select p.id
  into v_permiso_id
  from public.permisos as p
  where p.codigo = trim(p_permiso_codigo)
    and p.estado = 'activo';

  if v_permiso_id is null then
    raise exception 'Permiso activo no encontrado.'
      using errcode = '02000';
  end if;

  insert into public.rol_permisos (
    empresa_id,
    rol_id,
    permiso_id
  )
  values (
    v_empresa_id,
    p_rol_id,
    v_permiso_id
  )
  on conflict (empresa_id, rol_id, permiso_id) do nothing;

  get diagnostics v_inserted = row_count;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    'roles',
    p_rol_id,
    'asignar_permiso_rol',
    jsonb_build_object('permiso_codigo', trim(p_permiso_codigo), 'inserted', v_inserted > 0)
  );

  return query
  select p_rol_id, trim(p_permiso_codigo), v_inserted > 0;
end;
$$;

create or replace function public.quitar_permiso_rol(
  p_rol_id uuid,
  p_permiso_codigo text
)
returns table (
  rol_id uuid,
  permiso_codigo text,
  removed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_current_rol_id uuid;
  v_permiso_id uuid;
  v_role_active boolean := false;
  v_other_manage_roles integer := 0;
  v_deleted integer := 0;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.roles.manage') then
    raise exception 'Permiso admin.roles.manage requerido.'
      using errcode = '42501';
  end if;

  select p.rol_id
  into v_current_rol_id
  from public.profiles as p
  where p.id = v_user_id
    and p.empresa_id = v_empresa_id
    and p.estado = 'activo';

  select r.estado = 'activo'
  into v_role_active
  from public.roles as r
  where r.id = p_rol_id
    and r.empresa_id = v_empresa_id;

  if v_role_active is null then
    raise exception 'Rol no encontrado en la empresa actual.'
      using errcode = '02000';
  end if;

  select p.id
  into v_permiso_id
  from public.permisos as p
  where p.codigo = trim(p_permiso_codigo);

  if v_permiso_id is null then
    raise exception 'Permiso no encontrado.'
      using errcode = '02000';
  end if;

  if trim(p_permiso_codigo) = 'admin.roles.manage' then
    if p_rol_id = v_current_rol_id then
      raise exception 'No puedes quitar admin.roles.manage de tu rol actual.'
        using errcode = '42501';
    end if;

    if v_role_active then
      select count(*)
      into v_other_manage_roles
      from public.roles as r
      join public.rol_permisos as rp
        on rp.empresa_id = r.empresa_id
        and rp.rol_id = r.id
      join public.permisos as perm on perm.id = rp.permiso_id
      where r.empresa_id = v_empresa_id
        and r.id <> p_rol_id
        and r.estado = 'activo'
        and perm.codigo = 'admin.roles.manage'
        and perm.estado = 'activo';

      if v_other_manage_roles = 0 then
        raise exception 'Debe existir al menos un rol activo con admin.roles.manage.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  delete from public.rol_permisos as rp
  where rp.empresa_id = v_empresa_id
    and rp.rol_id = p_rol_id
    and rp.permiso_id = v_permiso_id;

  get diagnostics v_deleted = row_count;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    'roles',
    p_rol_id,
    'quitar_permiso_rol',
    jsonb_build_object('permiso_codigo', trim(p_permiso_codigo), 'removed', v_deleted > 0)
  );

  return query
  select p_rol_id, trim(p_permiso_codigo), v_deleted > 0;
end;
$$;

revoke all on function public.crear_rol_empresa(text, text) from public;
revoke all on function public.actualizar_rol_empresa(uuid, text, text) from public;
revoke all on function public.cambiar_estado_rol_empresa(uuid, text) from public;
revoke all on function public.asignar_permiso_rol(uuid, text) from public;
revoke all on function public.quitar_permiso_rol(uuid, text) from public;

grant execute on function public.crear_rol_empresa(text, text) to authenticated;
grant execute on function public.actualizar_rol_empresa(uuid, text, text) to authenticated;
grant execute on function public.cambiar_estado_rol_empresa(uuid, text) to authenticated;
grant execute on function public.asignar_permiso_rol(uuid, text) to authenticated;
grant execute on function public.quitar_permiso_rol(uuid, text) to authenticated;
