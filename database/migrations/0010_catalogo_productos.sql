-- biz.os basic products and services catalog.
-- Apply manually in Supabase SQL Editor after 0009.

create table public.catalogo_categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  estado text not null default 'activa',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint catalogo_categorias_estado_check
    check (estado in ('activa', 'inactiva')),
  constraint catalogo_categorias_empresa_nombre_unique
    unique (empresa_id, nombre),
  constraint catalogo_categorias_id_empresa_unique
    unique (id, empresa_id),
  constraint catalogo_categorias_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint catalogo_categorias_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index catalogo_categorias_empresa_id_idx
  on public.catalogo_categorias (empresa_id);
create index catalogo_categorias_empresa_estado_idx
  on public.catalogo_categorias (empresa_id, estado);
create index catalogo_categorias_empresa_nombre_idx
  on public.catalogo_categorias (empresa_id, nombre);

create trigger set_catalogo_categorias_updated_at
before update on public.catalogo_categorias
for each row execute function public.set_updated_at();

create table public.catalogo_productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  categoria_id uuid,
  tipo text not null default 'producto',
  codigo text,
  nombre text not null,
  descripcion text,
  unidad_medida text not null default 'unidad',
  precio_base numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(5, 2) not null default 0,
  moneda text not null default 'CRC',
  estado text not null default 'activo',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint catalogo_productos_tipo_check
    check (tipo in ('producto', 'servicio')),
  constraint catalogo_productos_estado_check
    check (estado in ('activo', 'inactivo')),
  constraint catalogo_productos_precio_base_check
    check (precio_base >= 0),
  constraint catalogo_productos_impuesto_porcentaje_check
    check (impuesto_porcentaje >= 0 and impuesto_porcentaje <= 100),
  constraint catalogo_productos_categoria_empresa_fkey
    foreign key (categoria_id, empresa_id)
    references public.catalogo_categorias(id, empresa_id)
    on delete set null (categoria_id),
  constraint catalogo_productos_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint catalogo_productos_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create unique index catalogo_productos_empresa_codigo_unique
  on public.catalogo_productos (empresa_id, codigo)
  where codigo is not null;

create index catalogo_productos_empresa_id_idx
  on public.catalogo_productos (empresa_id);
create index catalogo_productos_empresa_estado_idx
  on public.catalogo_productos (empresa_id, estado);
create index catalogo_productos_empresa_tipo_idx
  on public.catalogo_productos (empresa_id, tipo);
create index catalogo_productos_empresa_categoria_idx
  on public.catalogo_productos (empresa_id, categoria_id);
create index catalogo_productos_empresa_nombre_idx
  on public.catalogo_productos (empresa_id, nombre);
create index catalogo_productos_empresa_codigo_idx
  on public.catalogo_productos (empresa_id, codigo);

create trigger set_catalogo_productos_updated_at
before update on public.catalogo_productos
for each row execute function public.set_updated_at();

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('catalog.products.view', 'Ver productos y servicios', 'Permite consultar el catalogo comercial de productos y servicios.', null, 'activo'),
  ('catalog.products.create', 'Crear productos y servicios', 'Permite crear productos y servicios del catalogo comercial.', null, 'activo'),
  ('catalog.products.edit', 'Editar productos y servicios', 'Permite editar o cambiar estado de productos y servicios.', null, 'activo'),
  ('catalog.categories.view', 'Ver categorias de catalogo', 'Permite consultar categorias del catalogo comercial.', null, 'activo'),
  ('catalog.categories.create', 'Crear categorias de catalogo', 'Permite crear categorias del catalogo comercial.', null, 'activo'),
  ('catalog.categories.edit', 'Editar categorias de catalogo', 'Permite editar o cambiar estado de categorias.', null, 'activo')
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
    'catalog.products.view',
    'catalog.products.create',
    'catalog.products.edit',
    'catalog.categories.view',
    'catalog.categories.create',
    'catalog.categories.edit'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.catalogo_categorias enable row level security;
alter table public.catalogo_productos enable row level security;

grant select on public.catalogo_categorias to authenticated;
grant select on public.catalogo_productos to authenticated;

create policy catalogo_categorias_select_permission
on public.catalogo_categorias
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('catalog.categories.view')
    or public.current_user_has_permission('catalog.categories.create')
    or public.current_user_has_permission('catalog.categories.edit')
  )
);

create policy catalogo_productos_select_permission
on public.catalogo_productos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('catalog.products.view')
    or public.current_user_has_permission('catalog.products.create')
    or public.current_user_has_permission('catalog.products.edit')
  )
);

create or replace function public.crear_catalogo_categoria(
  p_nombre text,
  p_descripcion text default null
)
returns table (
  categoria_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_categoria public.catalogo_categorias%rowtype;
  v_nombre text := nullif(btrim(p_nombre), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('catalog.categories.create') then
    raise exception 'Permiso catalog.categories.create requerido.' using errcode = '42501';
  end if;

  if v_nombre is null then
    raise exception 'Nombre de categoria requerido.' using errcode = '22023';
  end if;

  insert into public.catalogo_categorias (
    empresa_id,
    nombre,
    descripcion,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    v_nombre,
    nullif(btrim(coalesce(p_descripcion, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_categoria;

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
    'catalogo_categorias',
    v_categoria.id,
    'crear_catalogo_categoria',
    to_jsonb(v_categoria)
  );

  return query select v_categoria.id, v_categoria.nombre, v_categoria.estado;
end;
$$;

create or replace function public.actualizar_catalogo_categoria(
  p_categoria_id uuid,
  p_nombre text,
  p_descripcion text default null
)
returns table (
  categoria_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.catalogo_categorias%rowtype;
  v_despues public.catalogo_categorias%rowtype;
  v_nombre text := nullif(btrim(p_nombre), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('catalog.categories.edit') then
    raise exception 'Permiso catalog.categories.edit requerido.' using errcode = '42501';
  end if;

  if v_nombre is null then
    raise exception 'Nombre de categoria requerido.' using errcode = '22023';
  end if;

  select c.* into v_antes
  from public.catalogo_categorias as c
  where c.id = p_categoria_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Categoria no encontrada.' using errcode = '02000';
  end if;

  update public.catalogo_categorias as c
  set
    nombre = v_nombre,
    descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
    updated_by = v_user_id
  where c.id = p_categoria_id
    and c.empresa_id = v_empresa_id
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
    'catalogo_categorias',
    p_categoria_id,
    'actualizar_catalogo_categoria',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

create or replace function public.cambiar_estado_catalogo_categoria(
  p_categoria_id uuid,
  p_estado text
)
returns table (
  categoria_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.catalogo_categorias%rowtype;
  v_despues public.catalogo_categorias%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('activa', 'inactiva') then
    raise exception 'Estado de categoria invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('catalog.categories.edit') then
    raise exception 'Permiso catalog.categories.edit requerido.' using errcode = '42501';
  end if;

  select c.* into v_antes
  from public.catalogo_categorias as c
  where c.id = p_categoria_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Categoria no encontrada.' using errcode = '02000';
  end if;

  update public.catalogo_categorias as c
  set
    estado = p_estado,
    updated_by = v_user_id
  where c.id = p_categoria_id
    and c.empresa_id = v_empresa_id
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
    'catalogo_categorias',
    p_categoria_id,
    'cambiar_estado_catalogo_categoria',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

create or replace function public.crear_catalogo_producto(
  p_tipo text,
  p_codigo text default null,
  p_nombre text default null,
  p_descripcion text default null,
  p_categoria_id uuid default null,
  p_unidad_medida text default 'unidad',
  p_precio_base numeric default 0,
  p_impuesto_porcentaje numeric default 0,
  p_moneda text default 'CRC'
)
returns table (
  producto_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_producto public.catalogo_productos%rowtype;
  v_codigo text := nullif(btrim(coalesce(p_codigo, '')), '');
  v_nombre text := nullif(btrim(p_nombre), '');
  v_unidad text := coalesce(nullif(btrim(coalesce(p_unidad_medida, '')), ''), 'unidad');
  v_moneda text := coalesce(nullif(btrim(coalesce(p_moneda, '')), ''), 'CRC');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('catalog.products.create') then
    raise exception 'Permiso catalog.products.create requerido.' using errcode = '42501';
  end if;

  if p_tipo not in ('producto', 'servicio') then
    raise exception 'Tipo de producto invalido.' using errcode = '22023';
  end if;

  if v_nombre is null then
    raise exception 'Nombre de producto requerido.' using errcode = '22023';
  end if;

  if coalesce(p_precio_base, 0) < 0
    or coalesce(p_impuesto_porcentaje, 0) < 0
    or coalesce(p_impuesto_porcentaje, 0) > 100 then
    raise exception 'Precio o impuesto invalido.' using errcode = '22023';
  end if;

  if p_categoria_id is not null and not exists (
    select 1
    from public.catalogo_categorias as c
    where c.id = p_categoria_id
      and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Categoria no encontrada.' using errcode = '02000';
  end if;

  insert into public.catalogo_productos (
    empresa_id,
    categoria_id,
    tipo,
    codigo,
    nombre,
    descripcion,
    unidad_medida,
    precio_base,
    impuesto_porcentaje,
    moneda,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_categoria_id,
    p_tipo,
    v_codigo,
    v_nombre,
    nullif(btrim(coalesce(p_descripcion, '')), ''),
    v_unidad,
    coalesce(p_precio_base, 0),
    coalesce(p_impuesto_porcentaje, 0),
    v_moneda,
    v_user_id,
    v_user_id
  )
  returning * into v_producto;

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
    'catalogo_productos',
    v_producto.id,
    'crear_catalogo_producto',
    to_jsonb(v_producto)
  );

  return query select v_producto.id, v_producto.nombre, v_producto.estado;
end;
$$;

create or replace function public.actualizar_catalogo_producto(
  p_producto_id uuid,
  p_tipo text,
  p_codigo text default null,
  p_nombre text default null,
  p_descripcion text default null,
  p_categoria_id uuid default null,
  p_unidad_medida text default 'unidad',
  p_precio_base numeric default 0,
  p_impuesto_porcentaje numeric default 0,
  p_moneda text default 'CRC'
)
returns table (
  producto_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.catalogo_productos%rowtype;
  v_despues public.catalogo_productos%rowtype;
  v_codigo text := nullif(btrim(coalesce(p_codigo, '')), '');
  v_nombre text := nullif(btrim(p_nombre), '');
  v_unidad text := coalesce(nullif(btrim(coalesce(p_unidad_medida, '')), ''), 'unidad');
  v_moneda text := coalesce(nullif(btrim(coalesce(p_moneda, '')), ''), 'CRC');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('catalog.products.edit') then
    raise exception 'Permiso catalog.products.edit requerido.' using errcode = '42501';
  end if;

  if p_tipo not in ('producto', 'servicio') then
    raise exception 'Tipo de producto invalido.' using errcode = '22023';
  end if;

  if v_nombre is null then
    raise exception 'Nombre de producto requerido.' using errcode = '22023';
  end if;

  if coalesce(p_precio_base, 0) < 0
    or coalesce(p_impuesto_porcentaje, 0) < 0
    or coalesce(p_impuesto_porcentaje, 0) > 100 then
    raise exception 'Precio o impuesto invalido.' using errcode = '22023';
  end if;

  select p.* into v_antes
  from public.catalogo_productos as p
  where p.id = p_producto_id
    and p.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Producto no encontrado.' using errcode = '02000';
  end if;

  if p_categoria_id is not null and not exists (
    select 1
    from public.catalogo_categorias as c
    where c.id = p_categoria_id
      and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Categoria no encontrada.' using errcode = '02000';
  end if;

  update public.catalogo_productos as p
  set
    categoria_id = p_categoria_id,
    tipo = p_tipo,
    codigo = v_codigo,
    nombre = v_nombre,
    descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
    unidad_medida = v_unidad,
    precio_base = coalesce(p_precio_base, 0),
    impuesto_porcentaje = coalesce(p_impuesto_porcentaje, 0),
    moneda = v_moneda,
    updated_by = v_user_id
  where p.id = p_producto_id
    and p.empresa_id = v_empresa_id
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
    'catalogo_productos',
    p_producto_id,
    'actualizar_catalogo_producto',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

create or replace function public.cambiar_estado_catalogo_producto(
  p_producto_id uuid,
  p_estado text
)
returns table (
  producto_id uuid,
  nombre text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.catalogo_productos%rowtype;
  v_despues public.catalogo_productos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('activo', 'inactivo') then
    raise exception 'Estado de producto invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('catalog.products.edit') then
    raise exception 'Permiso catalog.products.edit requerido.' using errcode = '42501';
  end if;

  select p.* into v_antes
  from public.catalogo_productos as p
  where p.id = p_producto_id
    and p.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Producto no encontrado.' using errcode = '02000';
  end if;

  update public.catalogo_productos as p
  set
    estado = p_estado,
    updated_by = v_user_id
  where p.id = p_producto_id
    and p.empresa_id = v_empresa_id
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
    'catalogo_productos',
    p_producto_id,
    'cambiar_estado_catalogo_producto',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

revoke all on function public.crear_catalogo_categoria(text, text) from public;
revoke all on function public.actualizar_catalogo_categoria(uuid, text, text) from public;
revoke all on function public.cambiar_estado_catalogo_categoria(uuid, text) from public;
revoke all on function public.crear_catalogo_producto(text, text, text, text, uuid, text, numeric, numeric, text) from public;
revoke all on function public.actualizar_catalogo_producto(uuid, text, text, text, text, uuid, text, numeric, numeric, text) from public;
revoke all on function public.cambiar_estado_catalogo_producto(uuid, text) from public;

grant execute on function public.crear_catalogo_categoria(text, text) to authenticated;
grant execute on function public.actualizar_catalogo_categoria(uuid, text, text) to authenticated;
grant execute on function public.cambiar_estado_catalogo_categoria(uuid, text) to authenticated;
grant execute on function public.crear_catalogo_producto(text, text, text, text, uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.actualizar_catalogo_producto(uuid, text, text, text, text, uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.cambiar_estado_catalogo_producto(uuid, text) to authenticated;
