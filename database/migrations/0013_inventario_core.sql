-- biz.os basic manual inventory core.
-- Apply manually in Supabase SQL Editor after 0012.

create unique index if not exists catalogo_productos_id_empresa_unique_idx
  on public.catalogo_productos (id, empresa_id);

create table public.inventario_bodegas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  ubicacion text,
  estado text not null default 'activa',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventario_bodegas_estado_check check (estado in ('activa', 'inactiva')),
  constraint inventario_bodegas_empresa_nombre_unique unique (empresa_id, nombre),
  constraint inventario_bodegas_id_empresa_unique unique (id, empresa_id),
  constraint inventario_bodegas_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint inventario_bodegas_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index inventario_bodegas_empresa_id_idx on public.inventario_bodegas (empresa_id);
create index inventario_bodegas_empresa_estado_idx on public.inventario_bodegas (empresa_id, estado);
create index inventario_bodegas_empresa_nombre_idx on public.inventario_bodegas (empresa_id, nombre);

create trigger set_inventario_bodegas_updated_at
before update on public.inventario_bodegas
for each row execute function public.set_updated_at();

create table public.inventario_stock (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null,
  bodega_id uuid not null,
  cantidad numeric(14, 2) not null default 0,
  stock_minimo numeric(14, 2) not null default 0,
  stock_maximo numeric(14, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventario_stock_cantidad_check check (cantidad >= 0),
  constraint inventario_stock_minimo_check check (stock_minimo >= 0),
  constraint inventario_stock_maximo_check check (stock_maximo is null or stock_maximo >= stock_minimo),
  constraint inventario_stock_empresa_producto_bodega_unique unique (empresa_id, producto_id, bodega_id),
  constraint inventario_stock_producto_empresa_fkey
    foreign key (producto_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint inventario_stock_bodega_empresa_fkey
    foreign key (bodega_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict
);

create index inventario_stock_empresa_id_idx on public.inventario_stock (empresa_id);
create index inventario_stock_empresa_producto_idx on public.inventario_stock (empresa_id, producto_id);
create index inventario_stock_empresa_bodega_idx on public.inventario_stock (empresa_id, bodega_id);
create index inventario_stock_empresa_cantidad_idx on public.inventario_stock (empresa_id, cantidad);

create trigger set_inventario_stock_updated_at
before update on public.inventario_stock
for each row execute function public.set_updated_at();

create table public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  producto_id uuid not null references public.catalogo_productos(id) on delete restrict,
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  tipo text not null,
  cantidad numeric(14, 2) not null,
  cantidad_anterior numeric(14, 2) not null,
  cantidad_nueva numeric(14, 2) not null,
  motivo text,
  referencia_tipo text,
  referencia_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint inventario_movimientos_tipo_check check (tipo in ('entrada', 'salida', 'ajuste')),
  constraint inventario_movimientos_cantidad_check check (cantidad > 0),
  constraint inventario_movimientos_anterior_check check (cantidad_anterior >= 0),
  constraint inventario_movimientos_nueva_check check (cantidad_nueva >= 0),
  constraint inventario_movimientos_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index inventario_movimientos_empresa_id_idx on public.inventario_movimientos (empresa_id);
create index inventario_movimientos_empresa_producto_idx on public.inventario_movimientos (empresa_id, producto_id);
create index inventario_movimientos_empresa_bodega_idx on public.inventario_movimientos (empresa_id, bodega_id);
create index inventario_movimientos_empresa_tipo_idx on public.inventario_movimientos (empresa_id, tipo);
create index inventario_movimientos_empresa_created_at_idx on public.inventario_movimientos (empresa_id, created_at);
create index inventario_movimientos_empresa_referencia_idx
  on public.inventario_movimientos (empresa_id, referencia_tipo, referencia_id);

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('inventory.stock.view', 'Ver stock', 'Permite consultar stock de inventario.', 'inventory', 'activo'),
  ('inventory.stock.adjust', 'Ajustar stock', 'Permite registrar movimientos manuales de inventario.', 'inventory', 'activo'),
  ('inventory.movements.view', 'Ver movimientos de inventario', 'Permite consultar historial de movimientos.', 'inventory', 'activo'),
  ('inventory.warehouses.view', 'Ver bodegas', 'Permite consultar bodegas de inventario.', 'inventory', 'activo'),
  ('inventory.warehouses.manage', 'Gestionar bodegas', 'Permite crear, editar y cambiar estado de bodegas.', 'inventory', 'activo')
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
    'inventory.stock.view',
    'inventory.stock.adjust',
    'inventory.movements.view',
    'inventory.warehouses.view',
    'inventory.warehouses.manage'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.inventario_bodegas enable row level security;
alter table public.inventario_stock enable row level security;
alter table public.inventario_movimientos enable row level security;

grant select on public.inventario_bodegas to authenticated;
grant select on public.inventario_stock to authenticated;
grant select on public.inventario_movimientos to authenticated;

create policy inventario_bodegas_select_permission
on public.inventario_bodegas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inventory.warehouses.view')
    or public.current_user_has_permission('inventory.warehouses.manage')
  )
);

create policy inventario_stock_select_permission
on public.inventario_stock
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inventory.stock.view')
    or public.current_user_has_permission('inventory.stock.adjust')
  )
);

create policy inventario_movimientos_select_permission
on public.inventario_movimientos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inventory.movements.view')
    or public.current_user_has_permission('inventory.stock.adjust')
  )
);

create policy catalogo_productos_select_inventory_permission
on public.catalogo_productos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and tipo = 'producto'
  and (
    public.current_user_has_permission('inventory.stock.view')
    or public.current_user_has_permission('inventory.stock.adjust')
  )
);

create or replace function public.crear_inventario_bodega(
  p_nombre text,
  p_descripcion text default null,
  p_ubicacion text default null
)
returns table (bodega_id uuid, nombre text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_bodega public.inventario_bodegas%rowtype;
  v_nombre text := nullif(btrim(p_nombre), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.warehouses.manage') then
    raise exception 'Permiso inventory.warehouses.manage requerido.' using errcode = '42501';
  end if;
  if v_nombre is null then
    raise exception 'Nombre de bodega requerido.' using errcode = '22023';
  end if;

  insert into public.inventario_bodegas (empresa_id, nombre, descripcion, ubicacion, created_by, updated_by)
  values (
    v_empresa_id,
    v_nombre,
    nullif(btrim(coalesce(p_descripcion, '')), ''),
    nullif(btrim(coalesce(p_ubicacion, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_bodega;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues)
  values (v_empresa_id, v_user_id, 'inventario_bodegas', v_bodega.id, 'crear_inventario_bodega', to_jsonb(v_bodega));

  return query select v_bodega.id, v_bodega.nombre, v_bodega.estado;
end;
$$;

create or replace function public.actualizar_inventario_bodega(
  p_bodega_id uuid,
  p_nombre text,
  p_descripcion text default null,
  p_ubicacion text default null
)
returns table (bodega_id uuid, nombre text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inventario_bodegas%rowtype;
  v_despues public.inventario_bodegas%rowtype;
  v_nombre text := nullif(btrim(p_nombre), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.warehouses.manage') then
    raise exception 'Permiso inventory.warehouses.manage requerido.' using errcode = '42501';
  end if;
  if v_nombre is null then
    raise exception 'Nombre de bodega requerido.' using errcode = '22023';
  end if;

  select b.* into v_antes
  from public.inventario_bodegas as b
  where b.id = p_bodega_id
    and b.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Bodega no encontrada.' using errcode = '02000';
  end if;

  update public.inventario_bodegas as b
  set nombre = v_nombre,
      descripcion = nullif(btrim(coalesce(p_descripcion, '')), ''),
      ubicacion = nullif(btrim(coalesce(p_ubicacion, '')), ''),
      updated_by = v_user_id
  where b.id = p_bodega_id
    and b.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues)
  values (v_empresa_id, v_user_id, 'inventario_bodegas', p_bodega_id, 'actualizar_inventario_bodega', to_jsonb(v_antes), to_jsonb(v_despues));

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

create or replace function public.cambiar_estado_inventario_bodega(
  p_bodega_id uuid,
  p_estado text
)
returns table (bodega_id uuid, nombre text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inventario_bodegas%rowtype;
  v_despues public.inventario_bodegas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if p_estado not in ('activa', 'inactiva') then
    raise exception 'Estado de bodega invalido.' using errcode = '22023';
  end if;
  if not public.current_user_has_permission('inventory.warehouses.manage') then
    raise exception 'Permiso inventory.warehouses.manage requerido.' using errcode = '42501';
  end if;

  select b.* into v_antes
  from public.inventario_bodegas as b
  where b.id = p_bodega_id
    and b.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Bodega no encontrada.' using errcode = '02000';
  end if;

  if p_estado = 'inactiva' and exists (
    select 1 from public.inventario_stock as s
    where s.empresa_id = v_empresa_id
      and s.bodega_id = p_bodega_id
      and s.cantidad > 0
  ) then
    raise exception 'No se puede inactivar una bodega con stock.' using errcode = '22023';
  end if;

  update public.inventario_bodegas as b
  set estado = p_estado,
      updated_by = v_user_id
  where b.id = p_bodega_id
    and b.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues)
  values (v_empresa_id, v_user_id, 'inventario_bodegas', p_bodega_id, 'cambiar_estado_inventario_bodega', to_jsonb(v_antes), to_jsonb(v_despues));

  return query select v_despues.id, v_despues.nombre, v_despues.estado;
end;
$$;

create or replace function public.registrar_movimiento_inventario(
  p_producto_id uuid,
  p_bodega_id uuid,
  p_tipo text,
  p_cantidad numeric,
  p_motivo text default null,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null
)
returns table (movimiento_id uuid, stock_id uuid, cantidad_nueva numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_stock public.inventario_stock%rowtype;
  v_movimiento public.inventario_movimientos%rowtype;
  v_anterior numeric(14, 2);
  v_nueva numeric(14, 2);
  v_mov_cantidad numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_tipo not in ('entrada', 'salida', 'ajuste') or p_cantidad <= 0 then
    raise exception 'Movimiento de inventario invalido.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.catalogo_productos as p
    where p.id = p_producto_id
      and p.empresa_id = v_empresa_id
      and p.tipo = 'producto'
      and p.estado = 'activo'
  ) then
    raise exception 'Producto de inventario no disponible.' using errcode = '02000';
  end if;

  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_bodega_id
      and b.empresa_id = v_empresa_id
      and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
  values (v_empresa_id, p_producto_id, p_bodega_id, 0)
  on conflict on constraint inventario_stock_empresa_producto_bodega_unique
  do nothing;

  select s.* into v_stock
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_producto_id
    and s.bodega_id = p_bodega_id
  for update;

  v_anterior := v_stock.cantidad;

  if p_tipo = 'entrada' then
    v_nueva := v_anterior + p_cantidad;
    v_mov_cantidad := p_cantidad;
  elsif p_tipo = 'salida' then
    if v_anterior < p_cantidad then
      raise exception 'Stock insuficiente para salida.' using errcode = '22023';
    end if;
    v_nueva := v_anterior - p_cantidad;
    v_mov_cantidad := p_cantidad;
  else
    v_nueva := p_cantidad;
    v_mov_cantidad := abs(p_cantidad - v_anterior);
    if v_mov_cantidad = 0 then
      raise exception 'Ajuste sin diferencia.' using errcode = '22023';
    end if;
  end if;

  update public.inventario_stock as s
  set cantidad = v_nueva
  where s.id = v_stock.id
  returning * into v_stock;

  insert into public.inventario_movimientos (
    empresa_id, producto_id, bodega_id, tipo, cantidad, cantidad_anterior,
    cantidad_nueva, motivo, referencia_tipo, referencia_id, created_by
  )
  values (
    v_empresa_id, p_producto_id, p_bodega_id, p_tipo, v_mov_cantidad,
    v_anterior, v_nueva, nullif(btrim(coalesce(p_motivo, '')), ''),
    nullif(btrim(coalesce(p_referencia_tipo, '')), ''), p_referencia_id, v_user_id
  )
  returning * into v_movimiento;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues)
  values (v_empresa_id, v_user_id, 'inventario_movimientos', v_movimiento.id, 'registrar_movimiento_inventario', to_jsonb(v_movimiento));

  return query select v_movimiento.id, v_stock.id, v_stock.cantidad;
end;
$$;

create or replace function public.actualizar_stock_minimos(
  p_producto_id uuid,
  p_bodega_id uuid,
  p_stock_minimo numeric default 0,
  p_stock_maximo numeric default null
)
returns table (stock_id uuid, cantidad numeric, stock_minimo numeric, stock_maximo numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inventario_stock%rowtype;
  v_despues public.inventario_stock%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if coalesce(p_stock_minimo, 0) < 0 or (p_stock_maximo is not null and p_stock_maximo < coalesce(p_stock_minimo, 0)) then
    raise exception 'Limites de stock invalidos.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.catalogo_productos as p
    where p.id = p_producto_id
      and p.empresa_id = v_empresa_id
      and p.tipo = 'producto'
  ) then
    raise exception 'Producto no encontrado.' using errcode = '02000';
  end if;

  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_bodega_id
      and b.empresa_id = v_empresa_id
  ) then
    raise exception 'Bodega no encontrada.' using errcode = '02000';
  end if;

  insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
  values (v_empresa_id, p_producto_id, p_bodega_id, 0)
  on conflict on constraint inventario_stock_empresa_producto_bodega_unique
  do nothing;

  select s.* into v_antes
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_producto_id
    and s.bodega_id = p_bodega_id;

  update public.inventario_stock as s
  set stock_minimo = coalesce(p_stock_minimo, 0),
      stock_maximo = p_stock_maximo
  where s.id = v_antes.id
  returning * into v_despues;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues)
  values (v_empresa_id, v_user_id, 'inventario_stock', v_despues.id, 'actualizar_stock_minimos', to_jsonb(v_antes), to_jsonb(v_despues));

  return query select v_despues.id, v_despues.cantidad, v_despues.stock_minimo, v_despues.stock_maximo;
end;
$$;

revoke all on function public.crear_inventario_bodega(text, text, text) from public;
revoke all on function public.actualizar_inventario_bodega(uuid, text, text, text) from public;
revoke all on function public.cambiar_estado_inventario_bodega(uuid, text) from public;
revoke all on function public.registrar_movimiento_inventario(uuid, uuid, text, numeric, text, text, uuid) from public;
revoke all on function public.actualizar_stock_minimos(uuid, uuid, numeric, numeric) from public;

grant execute on function public.crear_inventario_bodega(text, text, text) to authenticated;
grant execute on function public.actualizar_inventario_bodega(uuid, text, text, text) to authenticated;
grant execute on function public.cambiar_estado_inventario_bodega(uuid, text) to authenticated;
grant execute on function public.registrar_movimiento_inventario(uuid, uuid, text, numeric, text, text, uuid) to authenticated;
grant execute on function public.actualizar_stock_minimos(uuid, uuid, numeric, numeric) to authenticated;
