-- biz.os assisted sales inventory output.
-- Apply manually in Supabase SQL Editor after 0013.

alter table public.ventas
  add column if not exists inventario_estado text not null default 'pendiente',
  add column if not exists inventario_aplicado_at timestamptz,
  add column if not exists inventario_aplicado_por uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ventas_inventario_estado_check'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
      add constraint ventas_inventario_estado_check
      check (inventario_estado in ('pendiente', 'aplicado', 'parcial', 'no_aplica'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ventas_inventario_aplicado_por_empresa_fkey'
      and conrelid = 'public.ventas'::regclass
  ) then
    alter table public.ventas
      add constraint ventas_inventario_aplicado_por_empresa_fkey
      foreign key (inventario_aplicado_por, empresa_id)
      references public.profiles(id, empresa_id)
      on delete set null (inventario_aplicado_por);
  end if;
end;
$$;

create index if not exists ventas_empresa_inventario_estado_idx
  on public.ventas (empresa_id, inventario_estado);

create policy inventario_bodegas_select_sales_inventory_permission
on public.inventario_bodegas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and estado = 'activa'
  and public.current_user_has_permission('inventory.stock.adjust')
);

create or replace function public.obtener_resumen_inventario_venta(
  p_venta_id uuid
)
returns table (
  venta_id uuid,
  venta_item_id uuid,
  producto_id uuid,
  producto_nombre text,
  producto_codigo text,
  descripcion text,
  cantidad_requerida numeric,
  bodega_id uuid,
  bodega_nombre text,
  stock_disponible numeric,
  requiere_inventario boolean,
  stock_suficiente boolean,
  ya_aplicado boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_venta public.ventas%rowtype;
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('sales.orders.view') then
    raise exception 'Permiso sales.orders.view requerido.' using errcode = '42501';
  end if;

  select v.* into v_venta
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id;

  if v_venta.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  return query
  select
    vi.venta_id,
    vi.id as venta_item_id,
    vi.producto_id,
    cp.nombre as producto_nombre,
    cp.codigo as producto_codigo,
    vi.descripcion,
    vi.cantidad as cantidad_requerida,
    null::uuid as bodega_id,
    null::text as bodega_nombre,
    case
      when cp.id is not null and cp.tipo = 'producto'
        then coalesce(stock.stock_total, 0)
      else null
    end as stock_disponible,
    (cp.id is not null and cp.tipo = 'producto') as requiere_inventario,
    case
      when cp.id is not null and cp.tipo = 'producto'
        then coalesce(stock.stock_total, 0) >= vi.cantidad
      else true
    end as stock_suficiente,
    (
      v_venta.inventario_estado = 'aplicado'
      or exists (
        select 1
        from public.inventario_movimientos as im
        where im.empresa_id = v_empresa_id
          and im.referencia_tipo = 'venta'
          and im.referencia_id = p_venta_id
      )
    ) as ya_aplicado
  from public.venta_items as vi
  left join public.catalogo_productos as cp
    on cp.id = vi.producto_id
   and cp.empresa_id = v_empresa_id
  left join lateral (
    select sum(s.cantidad) as stock_total
    from public.inventario_stock as s
    join public.inventario_bodegas as b
      on b.id = s.bodega_id
     and b.empresa_id = s.empresa_id
     and b.estado = 'activa'
    where s.empresa_id = v_empresa_id
      and s.producto_id = vi.producto_id
  ) as stock on true
  where vi.empresa_id = v_empresa_id
    and vi.venta_id = p_venta_id
  order by vi.orden asc, vi.created_at asc;
end;
$$;

create or replace function public.aplicar_salida_inventario_venta(
  p_venta_id uuid,
  p_bodega_id uuid
)
returns table (
  venta_id uuid,
  numero text,
  inventario_estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_venta public.ventas%rowtype;
  v_despues public.ventas%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_item record;
  v_anterior numeric(14, 2);
  v_nueva numeric(14, 2);
  v_inventariable_count integer := 0;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('sales.orders.edit') then
    raise exception 'Permiso sales.orders.edit requerido.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;

  select v.* into v_venta
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
  for update;

  if v_venta.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_venta.estado not in ('confirmada', 'en_proceso') then
    raise exception 'La venta debe estar confirmada o en proceso.' using errcode = '22023';
  end if;

  if v_venta.inventario_estado = 'aplicado' then
    raise exception 'La salida de inventario ya fue aplicada.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.inventario_movimientos as im
    where im.empresa_id = v_empresa_id
      and im.referencia_tipo = 'venta'
      and im.referencia_id = p_venta_id
  ) then
    raise exception 'Ya existen movimientos de inventario para esta venta.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.inventario_bodegas as b
    where b.id = p_bodega_id
      and b.empresa_id = v_empresa_id
      and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  if exists (
    select 1
    from public.venta_items as vi
    join public.catalogo_productos as cp
      on cp.id = vi.producto_id
     and cp.empresa_id = v_empresa_id
    where vi.empresa_id = v_empresa_id
      and vi.venta_id = p_venta_id
      and vi.producto_id is not null
      and cp.tipo = 'producto'
      and cp.estado <> 'activo'
  ) then
    raise exception 'La venta contiene productos inventariables inactivos.' using errcode = '22023';
  end if;

  for v_item in
    select
      vi.id as venta_item_id,
      vi.producto_id,
      vi.descripcion,
      vi.cantidad,
      cp.nombre as producto_nombre
    from public.venta_items as vi
    join public.catalogo_productos as cp
      on cp.id = vi.producto_id
     and cp.empresa_id = v_empresa_id
     and cp.tipo = 'producto'
     and cp.estado = 'activo'
    where vi.empresa_id = v_empresa_id
      and vi.venta_id = p_venta_id
      and vi.producto_id is not null
    order by vi.orden asc, vi.created_at asc
  loop
    v_inventariable_count := v_inventariable_count + 1;

    insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
    values (v_empresa_id, v_item.producto_id, p_bodega_id, 0)
    on conflict on constraint inventario_stock_empresa_producto_bodega_unique
    do nothing;

    select s.* into v_stock
    from public.inventario_stock as s
    where s.empresa_id = v_empresa_id
      and s.producto_id = v_item.producto_id
      and s.bodega_id = p_bodega_id
    for update;

    v_anterior := v_stock.cantidad;

    if v_anterior < v_item.cantidad then
      raise exception 'Stock insuficiente para %.', v_item.producto_nombre using errcode = '22023';
    end if;

    v_nueva := v_anterior - v_item.cantidad;

    update public.inventario_stock as s
    set cantidad = v_nueva
    where s.id = v_stock.id;

    insert into public.inventario_movimientos (
      empresa_id,
      producto_id,
      bodega_id,
      tipo,
      cantidad,
      cantidad_anterior,
      cantidad_nueva,
      motivo,
      referencia_tipo,
      referencia_id,
      created_by
    )
    values (
      v_empresa_id,
      v_item.producto_id,
      p_bodega_id,
      'salida',
      v_item.cantidad,
      v_anterior,
      v_nueva,
      'Salida por venta ' || v_venta.numero,
      'venta',
      p_venta_id,
      v_user_id
    );
  end loop;

  if v_inventariable_count = 0 then
    raise exception 'La venta no tiene items inventariables.' using errcode = '22023';
  end if;

  update public.ventas as v
  set inventario_estado = 'aplicado',
      inventario_aplicado_at = now(),
      inventario_aplicado_por = v_user_id,
      actualizado_por = v_user_id
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
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
    'ventas',
    p_venta_id,
    'aplicar_salida_inventario_venta',
    to_jsonb(v_venta),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.inventario_estado;
end;
$$;

create or replace function public.marcar_venta_sin_inventario(
  p_venta_id uuid
)
returns table (
  venta_id uuid,
  numero text,
  inventario_estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.ventas%rowtype;
  v_despues public.ventas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('sales.orders.edit') then
    raise exception 'Permiso sales.orders.edit requerido.' using errcode = '42501';
  end if;

  select v.* into v_antes
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
  for update;

  if v_antes.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if exists (
    select 1
    from public.venta_items as vi
    join public.catalogo_productos as cp
      on cp.id = vi.producto_id
     and cp.empresa_id = v_empresa_id
     and cp.tipo = 'producto'
    where vi.empresa_id = v_empresa_id
      and vi.venta_id = p_venta_id
      and vi.producto_id is not null
  ) then
    raise exception 'La venta tiene items inventariables.' using errcode = '22023';
  end if;

  update public.ventas as v
  set inventario_estado = 'no_aplica',
      inventario_aplicado_at = null,
      inventario_aplicado_por = null,
      actualizado_por = v_user_id
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
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
    'ventas',
    p_venta_id,
    'marcar_venta_sin_inventario',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.inventario_estado;
end;
$$;

revoke all on function public.obtener_resumen_inventario_venta(uuid) from public;
revoke all on function public.aplicar_salida_inventario_venta(uuid, uuid) from public;
revoke all on function public.marcar_venta_sin_inventario(uuid) from public;

grant execute on function public.obtener_resumen_inventario_venta(uuid) to authenticated;
grant execute on function public.aplicar_salida_inventario_venta(uuid, uuid) to authenticated;
grant execute on function public.marcar_venta_sin_inventario(uuid) to authenticated;
