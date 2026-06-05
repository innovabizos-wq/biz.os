-- Personal invitations flow hardening.
-- Apply manually after 0025. Do not run automatically from the app.

alter table public.invitaciones_usuarios
  add column if not exists cedula text,
  add column if not exists telefono text,
  add column if not exists cargo text;

create or replace function public.crear_invitacion_usuario(
  p_correo text,
  p_nombre text,
  p_rol_id uuid,
  p_sucursal_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_cargo text default null
)
returns table (
  invitacion_id uuid,
  token text,
  correo text,
  fecha_expiracion timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_correo text := lower(trim(p_correo));
  v_token text;
  v_invitacion_id uuid;
  v_fecha_expiracion timestamptz := now() + interval '7 days';
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.users.manage') then
    raise exception 'Permiso admin.users.manage requerido.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.empresas as e
    where e.id = v_empresa_id
      and e.estado = 'activa'
  ) then
    raise exception 'Empresa actual inactiva o no encontrada.'
      using errcode = '22023';
  end if;

  if nullif(trim(p_nombre), '') is null then
    raise exception 'Nombre requerido.'
      using errcode = '22023';
  end if;

  if nullif(v_correo, '') is null
    or v_correo !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'Correo invalido.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where lower(trim(p.correo)) = v_correo
  ) then
    raise exception 'Este correo ya pertenece a un usuario del sistema.'
      using errcode = '23505';
  end if;

  update public.invitaciones_usuarios as i
  set estado = 'expirada'
  where i.empresa_id = v_empresa_id
    and lower(trim(i.correo)) = v_correo
    and i.estado = 'pendiente'
    and i.fecha_expiracion <= now();

  if exists (
    select 1
    from public.invitaciones_usuarios as i
    where i.empresa_id = v_empresa_id
      and lower(trim(i.correo)) = v_correo
      and i.estado = 'pendiente'
      and i.fecha_expiracion > now()
  ) then
    raise exception 'Ya existe una invitacion pendiente para este correo.'
      using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.roles as r
    where r.id = p_rol_id
      and r.empresa_id = v_empresa_id
      and r.estado = 'activo'
  ) then
    raise exception 'Rol o sucursal invalidos para esta empresa.'
      using errcode = '23503';
  end if;

  if p_sucursal_id is not null
    and not exists (
      select 1
      from public.sucursales as s
      where s.id = p_sucursal_id
        and s.empresa_id = v_empresa_id
        and s.estado = 'activa'
    ) then
    raise exception 'Rol o sucursal invalidos para esta empresa.'
      using errcode = '23503';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitaciones_usuarios (
    empresa_id,
    correo,
    nombre,
    cedula,
    telefono,
    cargo,
    rol_id,
    sucursal_id,
    token,
    invitado_por,
    fecha_expiracion
  )
  values (
    v_empresa_id,
    v_correo,
    trim(p_nombre),
    nullif(trim(p_cedula), ''),
    nullif(trim(p_telefono), ''),
    nullif(trim(p_cargo), ''),
    p_rol_id,
    p_sucursal_id,
    v_token,
    v_user_id,
    v_fecha_expiracion
  )
  returning id into v_invitacion_id;

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
    'invitaciones_usuarios',
    v_invitacion_id,
    'crear_invitacion_usuario',
    jsonb_build_object(
      'correo',
      v_correo,
      'personal',
      true
    )
  );

  return query
  select v_invitacion_id, v_token, v_correo, v_fecha_expiracion;
end;
$$;

create or replace function public.aceptar_invitacion_usuario(
  p_token text,
  p_nombre_usuario text default null,
  p_telefono_usuario text default null
)
returns table (
  empresa_id uuid,
  profile_id uuid,
  sucursal_id uuid,
  rol_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_inv public.invitaciones_usuarios%rowtype;
  v_nombre text;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
  ) then
    raise exception 'Esta cuenta ya pertenece a una empresa.'
      using errcode = '23505';
  end if;

  select *
  into v_inv
  from public.invitaciones_usuarios as i
  where i.token = trim(p_token)
  limit 1;

  if v_inv.id is null then
    raise exception 'Invitacion no encontrada.'
      using errcode = '02000';
  end if;

  if v_inv.estado = 'cancelada' then
    raise exception 'La invitacion fue cancelada.'
      using errcode = '22023';
  end if;

  if v_inv.estado = 'aceptada' then
    raise exception 'La invitacion ya fue aceptada.'
      using errcode = '22023';
  end if;

  if v_inv.estado = 'expirada' then
    raise exception 'La invitacion esta expirada.'
      using errcode = '22023';
  end if;

  if v_inv.fecha_expiracion <= now() then
    update public.invitaciones_usuarios
    set estado = 'expirada'
    where id = v_inv.id;

    raise exception 'La invitacion esta expirada.'
      using errcode = '22023';
  end if;

  if v_email is null or v_email <> lower(trim(v_inv.correo)) then
    raise exception 'El correo autenticado no coincide con la invitacion.'
      using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.empresas as e
    where e.id = v_inv.empresa_id
      and e.estado = 'activa'
  ) then
    raise exception 'Empresa actual inactiva o no encontrada.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.roles as r
    where r.id = v_inv.rol_id
      and r.empresa_id = v_inv.empresa_id
      and r.estado = 'activo'
  ) then
    raise exception 'Rol o sucursal invalidos para esta empresa.'
      using errcode = '23503';
  end if;

  if v_inv.sucursal_id is not null
    and not exists (
      select 1
      from public.sucursales as s
      where s.id = v_inv.sucursal_id
        and s.empresa_id = v_inv.empresa_id
        and s.estado = 'activa'
    ) then
    raise exception 'Rol o sucursal invalidos para esta empresa.'
      using errcode = '23503';
  end if;

  v_nombre := coalesce(nullif(trim(p_nombre_usuario), ''), v_inv.nombre);

  insert into public.profiles (
    id,
    empresa_id,
    sucursal_id,
    rol_id,
    nombre,
    correo,
    telefono,
    estado
  )
  values (
    v_user_id,
    v_inv.empresa_id,
    v_inv.sucursal_id,
    v_inv.rol_id,
    v_nombre,
    lower(trim(v_inv.correo)),
    coalesce(nullif(trim(p_telefono_usuario), ''), v_inv.telefono),
    'activo'
  );

  update public.invitaciones_usuarios
  set
    estado = 'aceptada',
    aceptada_por = v_user_id,
    aceptada_at = now()
  where id = v_inv.id;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_inv.empresa_id,
    v_user_id,
    'invitaciones_usuarios',
    v_inv.id,
    'aceptar_invitacion_usuario',
    jsonb_build_object('correo', v_inv.correo)
  );

  return query
  select v_inv.empresa_id, v_user_id, v_inv.sucursal_id, v_inv.rol_id;
end;
$$;

revoke all on function public.crear_invitacion_usuario(text, text, uuid, uuid, text, text, text)
  from public;

grant execute on function public.crear_invitacion_usuario(text, text, uuid, uuid, text, text, text)
  to authenticated;

revoke all on function public.aceptar_invitacion_usuario(text, text, text)
  from public;

grant execute on function public.aceptar_invitacion_usuario(text, text, text)
  to authenticated;
