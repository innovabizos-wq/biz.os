-- biz.os core SaaS multiempresa schema.
-- This file is local only. Review before applying it to any Supabase project.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  nombre_comercial text,
  identificacion_fiscal text,
  correo text,
  telefono text,
  estado text not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint empresas_estado_check
    check (estado in ('activa', 'inactiva', 'suspendida'))
);

create index empresas_estado_idx on public.empresas (estado);

create table public.sucursales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  codigo text,
  direccion text,
  telefono text,
  estado text not null default 'activa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sucursales_estado_check
    check (estado in ('activa', 'inactiva')),
  constraint sucursales_id_empresa_unique
    unique (id, empresa_id)
);

create unique index sucursales_empresa_codigo_unique
  on public.sucursales (empresa_id, codigo)
  where codigo is not null;

create index sucursales_empresa_id_idx on public.sucursales (empresa_id);
create index sucursales_estado_idx on public.sucursales (estado);
create index sucursales_empresa_estado_idx on public.sucursales (empresa_id, estado);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete restrict,
  sucursal_id uuid,
  rol_id uuid,
  nombre text not null,
  correo text not null,
  telefono text,
  estado text not null default 'activo',
  ultimo_acceso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_estado_check
    check (estado in ('activo', 'inactivo', 'suspendido')),
  constraint profiles_correo_unique
    unique (correo),
  constraint profiles_id_empresa_unique
    unique (id, empresa_id),
  constraint profiles_sucursal_empresa_fkey
    foreign key (sucursal_id, empresa_id)
    references public.sucursales(id, empresa_id)
    on delete set null (sucursal_id)
);

create index profiles_empresa_id_idx on public.profiles (empresa_id);
create index profiles_sucursal_id_idx on public.profiles (sucursal_id);
create index profiles_rol_id_idx on public.profiles (rol_id);
create unique index profiles_correo_lower_unique
  on public.profiles (lower(correo));
create index profiles_empresa_estado_idx on public.profiles (empresa_id, estado);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  es_sistema boolean not null default false,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roles_estado_check
    check (estado in ('activo', 'inactivo')),
  constraint roles_empresa_nombre_unique
    unique (empresa_id, nombre),
  constraint roles_id_empresa_unique
    unique (id, empresa_id)
);

create index roles_empresa_id_idx on public.roles (empresa_id);
create index roles_empresa_estado_idx on public.roles (empresa_id, estado);

alter table public.profiles
  add constraint profiles_rol_empresa_fkey
  foreign key (rol_id, empresa_id)
  references public.roles(id, empresa_id)
  on delete set null (rol_id);

create table public.modulos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  estado text not null default 'activo',
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint modulos_estado_check
    check (estado in ('activo', 'inactivo'))
);

create index modulos_codigo_idx on public.modulos (codigo);
create index modulos_estado_idx on public.modulos (estado);

create table public.permisos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  modulo_codigo text,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),

  constraint permisos_estado_check
    check (estado in ('activo', 'inactivo'))
);

create index permisos_codigo_idx on public.permisos (codigo);
create index permisos_modulo_codigo_idx on public.permisos (modulo_codigo);

alter table public.permisos
  add constraint permisos_modulo_codigo_fkey
  foreign key (modulo_codigo)
  references public.modulos(codigo)
  on update cascade
  on delete restrict;

create table public.rol_permisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol_id uuid not null,
  permiso_id uuid not null references public.permisos(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint rol_permisos_empresa_rol_permiso_unique
    unique (empresa_id, rol_id, permiso_id),
  constraint rol_permisos_rol_empresa_fkey
    foreign key (rol_id, empresa_id)
    references public.roles(id, empresa_id)
    on delete cascade
);

create index rol_permisos_empresa_id_idx on public.rol_permisos (empresa_id);
create index rol_permisos_rol_id_idx on public.rol_permisos (rol_id);

create table public.empresa_modulos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  modulo_id uuid not null references public.modulos(id) on delete cascade,
  estado text not null default 'activo',
  fecha_activacion timestamptz not null default now(),
  fecha_desactivacion timestamptz,
  configuracion jsonb not null default '{}'::jsonb,

  constraint empresa_modulos_estado_check
    check (estado in ('activo', 'inactivo')),
  constraint empresa_modulos_fecha_desactivacion_check
    check (
      fecha_desactivacion is null
      or fecha_desactivacion >= fecha_activacion
    ),
  constraint empresa_modulos_empresa_modulo_unique
    unique (empresa_id, modulo_id)
);

create index empresa_modulos_empresa_id_idx on public.empresa_modulos (empresa_id);
create index empresa_modulos_modulo_id_idx on public.empresa_modulos (modulo_id);
create index empresa_modulos_empresa_estado_idx
  on public.empresa_modulos (empresa_id, estado);

create table public.planes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  precio_base numeric(12, 2) not null default 0,
  estado text not null default 'activo',
  limites jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint planes_estado_check
    check (estado in ('activo', 'inactivo'))
);

create index planes_codigo_idx on public.planes (codigo);
create index planes_estado_idx on public.planes (estado);

create table public.empresa_plan (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  plan_id uuid not null references public.planes(id) on delete restrict,
  estado text not null default 'activo',
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  renovacion_automatica boolean not null default true,
  limites_override jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint empresa_plan_estado_check
    check (estado in ('activo', 'inactivo', 'cancelado', 'vencido')),
  constraint empresa_plan_fecha_fin_check
    check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

create index empresa_plan_empresa_id_idx on public.empresa_plan (empresa_id);
create index empresa_plan_plan_id_idx on public.empresa_plan (plan_id);
create index empresa_plan_empresa_estado_idx on public.empresa_plan (empresa_id, estado);

create unique index empresa_plan_un_plan_activo_idx
  on public.empresa_plan (empresa_id)
  where estado = 'activo';

create table public.configuraciones_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  clave text not null,
  valor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint configuraciones_empresa_clave_unique
    unique (empresa_id, clave)
);

create index configuraciones_empresa_empresa_id_idx
  on public.configuraciones_empresa (empresa_id);

create table public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid,
  sucursal_id uuid,
  entidad text not null,
  entidad_id uuid,
  accion text not null,
  datos_antes jsonb,
  datos_despues jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),

  constraint auditoria_eventos_usuario_empresa_fkey
    foreign key (usuario_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (usuario_id),
  constraint auditoria_eventos_sucursal_empresa_fkey
    foreign key (sucursal_id, empresa_id)
    references public.sucursales(id, empresa_id)
    on delete set null (sucursal_id)
);

create index auditoria_eventos_empresa_id_idx on public.auditoria_eventos (empresa_id);
create index auditoria_eventos_usuario_id_idx on public.auditoria_eventos (usuario_id);
create index auditoria_eventos_entidad_idx on public.auditoria_eventos (entidad, entidad_id);
create index auditoria_eventos_created_at_idx on public.auditoria_eventos (created_at);
create index auditoria_eventos_empresa_created_at_idx
  on public.auditoria_eventos (empresa_id, created_at);

create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.empresa_id
  from public.profiles as p
  where p.id = auth.uid()
    and p.estado = 'activo'
  limit 1;
$$;

revoke all on function public.current_empresa_id() from public;
grant execute on function public.current_empresa_id() to authenticated;

create trigger set_empresas_updated_at
before update on public.empresas
for each row execute function public.set_updated_at();

create trigger set_sucursales_updated_at
before update on public.sucursales
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger set_configuraciones_empresa_updated_at
before update on public.configuraciones_empresa
for each row execute function public.set_updated_at();
