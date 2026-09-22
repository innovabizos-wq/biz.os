-- Bounded operational reads and database-side summaries for stage 2.

create index if not exists inventario_stock_empresa_updated_page_idx
  on public.inventario_stock (empresa_id, updated_at desc, id desc);

create index if not exists inventario_movimientos_empresa_created_page_idx
  on public.inventario_movimientos (empresa_id, created_at desc, id desc);

create index if not exists purchases_orders_empresa_created_page_idx
  on public.purchases_orders (empresa_id, created_at desc, id desc);

create index if not exists despachos_empresa_created_page_idx
  on public.despachos (empresa_id, created_at desc, id desc);

create or replace function public.get_inventory_operational_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not (
    public.current_user_has_permission('inventory.stock.view')
    or public.current_user_has_permission('inventory.stock.adjust')
  ) then
    raise exception 'PERMISSION_DENIED';
  end if;

  return jsonb_build_object(
    'bodegasActivas', (
      select count(*) from public.inventario_bodegas
      where empresa_id = v_empresa_id and estado = 'activa'
    ),
    'movimientosRecientes', least(10, (
      select count(*) from public.inventario_movimientos
      where empresa_id = v_empresa_id
    )),
    'productosBajoStock', (
      select count(*) from public.inventario_stock
      where empresa_id = v_empresa_id
        and stock_minimo > 0
        and cantidad < stock_minimo
    ),
    'productosConStock', (
      select count(distinct producto_id) from public.inventario_stock
      where empresa_id = v_empresa_id and cantidad > 0
    )
  );
end;
$$;

create or replace function public.get_purchases_operational_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not (
    public.current_user_has_permission('purchases.orders.view')
    or public.current_user_has_permission('purchases.orders.manage')
  ) then
    raise exception 'PERMISSION_DENIED';
  end if;

  return jsonb_build_object(
    'proveedoresActivos', (
      select count(*) from public.purchases_suppliers
      where empresa_id = v_empresa_id and estado = 'activo'
    ),
    'ordenesBorrador', (
      select count(*) from public.purchases_orders
      where empresa_id = v_empresa_id and estado = 'borrador'
    ),
    'ordenesEmitidas', (
      select count(*) from public.purchases_orders
      where empresa_id = v_empresa_id and estado = 'emitida'
    ),
    'ordenesParciales', (
      select count(*) from public.purchases_orders
      where empresa_id = v_empresa_id and estado = 'parcial'
    ),
    'ordenesRecibidas', (
      select count(*) from public.purchases_orders
      where empresa_id = v_empresa_id and estado = 'recibida'
    ),
    'totalComprado', coalesce((
      select sum(total) from public.purchases_orders
      where empresa_id = v_empresa_id and estado = 'recibida'
    ), 0),
    'totalPendienteRecepcion', coalesce((
      select sum((i.cantidad - coalesce(i.cantidad_recibida, 0)) * i.costo_unitario)
      from public.purchases_order_items i
      join public.purchases_orders o
        on o.id = i.order_id and o.empresa_id = i.empresa_id
      where i.empresa_id = v_empresa_id
        and o.estado in ('emitida', 'parcial')
    ), 0)
  );
end;
$$;

create or replace function public.get_dispatch_operational_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
  v_today date := (now() at time zone 'America/Costa_Rica')::date;
  v_dispatches_today bigint;
  v_delivered_today bigint;
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.current_user_has_permission('dispatch.orders.view') then
    raise exception 'PERMISSION_DENIED';
  end if;

  select count(*) into v_dispatches_today
  from public.despachos
  where empresa_id = v_empresa_id
    and (
      fecha_programada = v_today
      or (fecha_programada is null and (created_at at time zone 'America/Costa_Rica')::date = v_today)
    );

  select count(*) into v_delivered_today
  from public.despachos
  where empresa_id = v_empresa_id
    and estado = 'entregado'
    and (coalesce(completado_at, updated_at) at time zone 'America/Costa_Rica')::date = v_today;

  return jsonb_build_object(
    'stats', jsonb_build_object(
      'availableDrivers', 0,
      'connectedDrivers', (
        select case when count(distinct responsable_id) > 0
          then count(distinct responsable_id) else count(*) end
        from public.despachos
        where empresa_id = v_empresa_id
          and estado in ('preparando', 'listo', 'en_ruta', 'parcial')
      ),
      'deliveredToday', v_delivered_today,
      'incidents', (
        select count(*) from public.despachos
        where empresa_id = v_empresa_id and estado = 'fallido'
      ),
      'lunchDrivers', 0,
      'onRouteDrivers', (
        select case when count(distinct responsable_id) > 0
          then count(distinct responsable_id) else count(*) end
        from public.despachos
        where empresa_id = v_empresa_id and estado = 'en_ruta'
      ),
      'pausedDrivers', 0,
      'pendingDispatches', (
        select count(*) from public.despachos
        where empresa_id = v_empresa_id
          and estado in ('pendiente', 'preparando', 'listo', 'parcial')
      )
    ),
    'summary', jsonb_build_object(
      'delays', 0,
      'dispatchesToday', v_dispatches_today,
      'effectiveness', case when v_dispatches_today > 0
        then round((v_delivered_today::numeric / v_dispatches_today::numeric) * 100)
        else 0 end
    )
  );
end;
$$;

revoke all on function public.get_inventory_operational_summary() from public, anon;
revoke all on function public.get_purchases_operational_summary() from public, anon;
revoke all on function public.get_dispatch_operational_summary() from public, anon;
grant execute on function public.get_inventory_operational_summary() to authenticated;
grant execute on function public.get_purchases_operational_summary() to authenticated;
grant execute on function public.get_dispatch_operational_summary() to authenticated;

comment on function public.get_inventory_operational_summary() is
  'Tenant-scoped inventory aggregates for bounded operational pages.';

comment on function public.get_purchases_operational_summary() is
  'Tenant-scoped purchasing aggregates, including pending receipt value.';

comment on function public.get_dispatch_operational_summary() is
  'Tenant-scoped dispatch aggregates calculated in Costa Rica business time.';
