-- biz.os user invitations.
-- Apply manually in Supabase SQL Editor after 0001 and 0002.

create table public.invitaciones_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  correo text not null,
  nombre text not null,
  rol_id uuid not null,
  sucursal_id uuid,
  token text not null unique,
  estado text not null default 'pendiente',
  invitado_por uuid,
  aceptada_por uuid,
  fecha_expiracion timestamptz not null,
  aceptada_at timestamptz,
  cancelada_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invitaciones_usuarios_estado_check
    check (estado in ('pendiente', 'aceptada', 'cancelada', 'expirada')),
  constraint invitaciones_usuarios_fecha_expiracion_check
    check (fecha_expiracion > created_at),
  constraint invitaciones_usuarios_aceptada_check
    check (estado <> 'aceptada' or aceptada_at is not null),
  constraint invitaciones_usuarios_cancelada_check
    check (estado <> 'cancelada' or cancelada_at is not null),
  constraint invitaciones_usuarios_rol_empresa_fkey
    foreign key (rol_id, empresa_id)
    references public.roles(id, empresa_id)
    on delete restrict,
  constraint invitaciones_usuarios_sucursal_empresa_fkey
    foreign key (sucursal_id, empresa_id)
    references public.sucursales(id, empresa_id)
    on delete set null (sucursal_id),
  constraint invitaciones_usuarios_invitado_por_empresa_fkey
    foreign key (invitado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (invitado_por),
  constraint invitaciones_usuarios_aceptada_por_empresa_fkey
    foreign key (aceptada_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (aceptada_por)
);

create unique index invitaciones_usuarios_pendiente_correo_unique
  on public.invitaciones_usuarios (empresa_id, lower(correo))
  where estado = 'pendiente';

create index invitaciones_usuarios_empresa_estado_idx
  on public.invitaciones_usuarios (empresa_id, estado);

create index invitaciones_usuarios_token_idx
  on public.invitaciones_usuarios (token);

create index invitaciones_usuarios_correo_lower_idx
  on public.invitaciones_usuarios (lower(correo));

create trigger set_invitaciones_usuarios_updated_at
before update on public.invitaciones_usuarios
for each row execute function public.set_updated_at();

create or replace function public.current_user_has_permission(
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    join public.rol_permisos as rp
      on rp.empresa_id = p.empresa_id
      and rp.rol_id = p.rol_id
    join public.permisos as perm
      on perm.id = rp.permiso_id
    where p.id = auth.uid()
      and p.estado = 'activo'
      and perm.codigo = p_permission_code
      and perm.estado = 'activo'
  );
$$;

revoke all on function public.current_user_has_permission(text) from public;
grant execute on function public.current_user_has_permission(text) to authenticated;

alter table public.invitaciones_usuarios enable row level security;

grant select on public.invitaciones_usuarios to authenticated;

create policy invitaciones_usuarios_select_admin
on public.invitaciones_usuarios
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.users.view')
    or public.current_user_has_permission('admin.users.manage')
  )
);

create or replace function public.crear_invitacion_usuario(
  p_correo text,
  p_nombre text,
  p_rol_id uuid,
  p_sucursal_id uuid default null
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

  if nullif(v_correo, '') is null then
    raise exception 'Correo requerido.'
      using errcode = '22023';
  end if;

  if nullif(trim(p_nombre), '') is null then
    raise exception 'Nombre requerido.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.roles as r
    where r.id = p_rol_id
      and r.empresa_id = v_empresa_id
      and r.estado = 'activo'
  ) then
    raise exception 'Rol invalido para la empresa actual.'
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
    raise exception 'Sucursal invalida para la empresa actual.'
      using errcode = '23503';
  end if;

  if exists (
    select 1
    from public.invitaciones_usuarios as i
    where i.empresa_id = v_empresa_id
      and lower(i.correo) = v_correo
      and i.estado = 'pendiente'
  ) then
    raise exception 'Ya existe una invitacion pendiente para este correo.'
      using errcode = '23505';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.invitaciones_usuarios (
    empresa_id,
    correo,
    nombre,
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
    jsonb_build_object('correo', v_correo)
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

  if v_inv.estado <> 'pendiente' then
    raise exception 'La invitacion no esta pendiente.'
      using errcode = '22023';
  end if;

  if v_inv.fecha_expiracion <= now() then
    update public.invitaciones_usuarios
    set estado = 'expirada'
    where id = v_inv.id;

    raise exception 'La invitacion esta expirada.'
      using errcode = '22023';
  end if;

  if v_email is null or v_email <> lower(v_inv.correo) then
    raise exception 'El correo autenticado no coincide con la invitacion.'
      using errcode = '28000';
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
    v_inv.correo,
    nullif(trim(p_telefono_usuario), ''),
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

revoke all on function public.crear_invitacion_usuario(text, text, uuid, uuid)
  from public;

revoke all on function public.aceptar_invitacion_usuario(text, text, text)
  from public;

grant execute on function public.crear_invitacion_usuario(text, text, uuid, uuid)
  to authenticated;

grant execute on function public.aceptar_invitacion_usuario(text, text, text)
  to authenticated;
