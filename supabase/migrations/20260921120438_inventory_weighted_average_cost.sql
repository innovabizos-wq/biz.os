-- Per-warehouse weighted-average inventory valuation with immutable movement snapshots.

alter table public.inventario_stock
  add column if not exists average_unit_cost numeric(14, 6),
  add column if not exists cost_status text not null default 'complete';

update public.inventario_stock
set
  average_unit_cost = case when cantidad = 0 then 0 else null end,
  cost_status = case when cantidad = 0 then 'complete' else 'incomplete' end
where average_unit_cost is null;

alter table public.inventario_stock
  alter column average_unit_cost set default 0;

alter table public.inventario_stock
  drop constraint if exists inventario_stock_average_unit_cost_check;
alter table public.inventario_stock
  add constraint inventario_stock_average_unit_cost_check
  check (average_unit_cost is null or average_unit_cost >= 0);

alter table public.inventario_stock
  drop constraint if exists inventario_stock_cost_status_check;
alter table public.inventario_stock
  add constraint inventario_stock_cost_status_check
  check (
    (cost_status = 'complete' and average_unit_cost is not null)
    or cost_status = 'incomplete'
  );

alter table public.inventario_movimientos
  add column if not exists source_item_id uuid,
  add column if not exists unit_cost numeric(14, 6),
  add column if not exists total_cost numeric(16, 2),
  add column if not exists average_cost_before numeric(14, 6),
  add column if not exists average_cost_after numeric(14, 6),
  add column if not exists cost_status text not null default 'incomplete';

alter table public.inventario_movimientos
  drop constraint if exists inventario_movimientos_cost_values_check;
alter table public.inventario_movimientos
  add constraint inventario_movimientos_cost_values_check
  check (
    (unit_cost is null or unit_cost >= 0)
    and (total_cost is null or total_cost >= 0)
    and (average_cost_before is null or average_cost_before >= 0)
    and (average_cost_after is null or average_cost_after >= 0)
  );

alter table public.inventario_movimientos
  drop constraint if exists inventario_movimientos_cost_status_check;
alter table public.inventario_movimientos
  add constraint inventario_movimientos_cost_status_check
  check (
    cost_status in ('complete', 'incomplete')
    and (
      cost_status = 'incomplete'
      or (unit_cost is not null and total_cost is not null)
    )
  );

create index if not exists inventario_movimientos_source_item_idx
  on public.inventario_movimientos (empresa_id, referencia_tipo, referencia_id, source_item_id)
  where source_item_id is not null;

create table if not exists public.inventory_cost_reconciliations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  product_id uuid not null,
  warehouse_id uuid not null,
  previous_unit_cost numeric(14, 6),
  previous_status text not null,
  new_unit_cost numeric(14, 6) not null,
  reason text not null,
  operation_id uuid not null,
  request_payload jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint inventory_cost_reconciliations_id_empresa_unique unique (id, empresa_id),
  constraint inventory_cost_reconciliations_operation_unique unique (empresa_id, operation_id),
  constraint inventory_cost_reconciliations_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint inventory_cost_reconciliations_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint inventory_cost_reconciliations_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint inventory_cost_reconciliations_previous_status_check
    check (previous_status in ('complete', 'incomplete')),
  constraint inventory_cost_reconciliations_cost_check
    check (new_unit_cost >= 0 and (previous_unit_cost is null or previous_unit_cost >= 0)),
  constraint inventory_cost_reconciliations_request_check
    check (jsonb_typeof(request_payload) = 'object')
);

create index if not exists inventory_cost_reconciliations_stock_idx
  on public.inventory_cost_reconciliations (empresa_id, product_id, warehouse_id, created_at desc);
create index if not exists inventory_cost_reconciliations_product_empresa_fkey_idx
  on public.inventory_cost_reconciliations (product_id, empresa_id);
create index if not exists inventory_cost_reconciliations_warehouse_empresa_fkey_idx
  on public.inventory_cost_reconciliations (warehouse_id, empresa_id);
create index if not exists inventory_cost_reconciliations_created_by_empresa_fkey_idx
  on public.inventory_cost_reconciliations (created_by, empresa_id);

alter table public.inventory_cost_reconciliations enable row level security;
revoke all on table public.inventory_cost_reconciliations from public, anon, authenticated;
grant select on table public.inventory_cost_reconciliations to authenticated;

drop policy if exists inventory_cost_reconciliations_select_permission
  on public.inventory_cost_reconciliations;
create policy inventory_cost_reconciliations_select_permission
on public.inventory_cost_reconciliations for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('inventory.stock.view'))
    or (select public.current_user_has_permission('inventory.stock.adjust'))
  )
);

create or replace function public.capture_inventory_movement_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock public.inventario_stock%rowtype;
  v_before_cost numeric(14, 6);
  v_after_cost numeric(14, 6);
  v_unit_cost numeric(14, 6);
  v_before_status text;
  v_after_status text;
  v_source_status text := 'incomplete';
begin
  select s.* into v_stock
  from public.inventario_stock as s
  where s.empresa_id = new.empresa_id
    and s.producto_id = new.producto_id
    and s.bodega_id = new.bodega_id
  for update;

  if v_stock.id is null
     or v_stock.cantidad <> new.cantidad_nueva
     or new.cantidad_anterior < 0
     or new.cantidad_nueva < 0 then
    raise exception 'El movimiento no coincide con el stock actualizado.' using errcode = '22023';
  end if;

  v_before_cost := v_stock.average_unit_cost;
  v_before_status := v_stock.cost_status;

  if new.referencia_tipo = 'purchase_receipt' then
    select pri.id, pri.costo_unitario, 'complete'
    into new.source_item_id, v_unit_cost, v_source_status
    from public.purchases_receipt_items as pri
    where pri.empresa_id = new.empresa_id
      and pri.receipt_id = new.referencia_id
      and pri.producto_id = new.producto_id
      and not exists (
        select 1
        from public.inventario_movimientos as im
        where im.empresa_id = new.empresa_id
          and im.referencia_tipo = 'purchase_receipt'
          and im.referencia_id = new.referencia_id
          and im.source_item_id = pri.id
      )
    order by pri.created_at, pri.id
    limit 1;
  elsif new.referencia_tipo = 'venta' then
    select vi.id
    into new.source_item_id
    from public.venta_items as vi
    where vi.empresa_id = new.empresa_id
      and vi.venta_id = new.referencia_id
      and vi.producto_id = new.producto_id
      and not exists (
        select 1
        from public.inventario_movimientos as im
        where im.empresa_id = new.empresa_id
          and im.referencia_tipo = 'venta'
          and im.referencia_id = new.referencia_id
          and im.source_item_id = vi.id
      )
    order by vi.orden, vi.created_at, vi.id
    limit 1;
  elsif new.referencia_tipo = 'sales_return' then
    select sri.id, source_movement.unit_cost, source_movement.cost_status
    into new.source_item_id, v_unit_cost, v_source_status
    from public.sales_return_items as sri
    left join public.inventario_movimientos as source_movement
      on source_movement.empresa_id = sri.empresa_id
     and source_movement.referencia_tipo = 'venta'
     and source_movement.source_item_id = sri.sale_item_id
    where sri.empresa_id = new.empresa_id
      and sri.return_id = new.referencia_id
      and sri.product_id = new.producto_id
      and not exists (
        select 1
        from public.inventario_movimientos as im
        where im.empresa_id = new.empresa_id
          and im.referencia_tipo = 'sales_return'
          and im.referencia_id = new.referencia_id
          and im.source_item_id = sri.id
      )
    order by sri.created_at, sri.id
    limit 1;
  elsif new.referencia_tipo = 'purchase_return' then
    select pri.id
    into new.source_item_id
    from public.purchase_return_items as pri
    where pri.empresa_id = new.empresa_id
      and pri.return_id = new.referencia_id
      and pri.product_id = new.producto_id
      and pri.warehouse_id = new.bodega_id
      and not exists (
        select 1
        from public.inventario_movimientos as im
        where im.empresa_id = new.empresa_id
          and im.referencia_tipo = 'purchase_return'
          and im.referencia_id = new.referencia_id
          and im.source_item_id = pri.id
      )
    order by pri.created_at, pri.id
    limit 1;
  elsif new.referencia_tipo = 'traslado_bodega' and new.tipo = 'entrada' then
    select im.unit_cost, im.cost_status
    into v_unit_cost, v_source_status
    from public.inventario_movimientos as im
    where im.empresa_id = new.empresa_id
      and im.referencia_tipo = 'traslado_bodega'
      and im.referencia_id = new.referencia_id
      and im.producto_id = new.producto_id
      and im.tipo = 'salida'
    order by im.created_at desc, im.id desc
    limit 1;
  end if;

  if new.tipo = 'entrada' then
    if new.referencia_tipo = 'sales_return' and v_unit_cost is null then
      v_source_status := 'incomplete';
    elsif new.referencia_tipo not in ('purchase_receipt', 'sales_return', 'traslado_bodega') then
      v_unit_cost := null;
      v_source_status := 'incomplete';
    end if;

    if v_unit_cost is not null
       and v_source_status = 'complete'
       and (
         new.cantidad_anterior = 0
         or (v_before_status = 'complete' and v_before_cost is not null)
       ) then
      v_after_cost := case
        when new.cantidad_nueva = 0 then 0
        when new.cantidad_anterior = 0 then v_unit_cost
        else round(
          (
            new.cantidad_anterior * v_before_cost
            + new.cantidad * v_unit_cost
          ) / new.cantidad_nueva,
          6
        )
      end;
      v_after_status := 'complete';
    else
      v_after_cost := null;
      v_after_status := 'incomplete';
    end if;
  elsif new.tipo = 'salida' then
    if v_before_status = 'complete' and v_before_cost is not null then
      v_unit_cost := v_before_cost;
      v_source_status := 'complete';
    else
      v_unit_cost := null;
      v_source_status := 'incomplete';
    end if;

    if new.cantidad_nueva = 0 then
      v_after_cost := 0;
      v_after_status := 'complete';
    else
      v_after_cost := v_before_cost;
      v_after_status := v_before_status;
    end if;
  else
    if new.cantidad_nueva <= new.cantidad_anterior then
      if v_before_status = 'complete' and v_before_cost is not null then
        v_unit_cost := v_before_cost;
        v_source_status := 'complete';
      end if;
      v_after_cost := case when new.cantidad_nueva = 0 then 0 else v_before_cost end;
      v_after_status := case when new.cantidad_nueva = 0 then 'complete' else v_before_status end;
    else
      v_unit_cost := null;
      v_source_status := 'incomplete';
      v_after_cost := null;
      v_after_status := 'incomplete';
    end if;
  end if;

  new.unit_cost := v_unit_cost;
  new.total_cost := case
    when v_unit_cost is null then null
    else round(new.cantidad * v_unit_cost, 2)
  end;
  new.average_cost_before := v_before_cost;
  new.average_cost_after := v_after_cost;
  new.cost_status := case
    when v_unit_cost is not null and v_source_status = 'complete' then 'complete'
    else 'incomplete'
  end;

  update public.inventario_stock as s
  set
    average_unit_cost = v_after_cost,
    cost_status = v_after_status
  where s.id = v_stock.id
    and s.empresa_id = new.empresa_id;

  return new;
end;
$$;

drop trigger if exists capture_inventario_movimiento_cost
  on public.inventario_movimientos;
create trigger capture_inventario_movimiento_cost
before insert on public.inventario_movimientos
for each row execute function public.capture_inventory_movement_cost();

revoke all on function public.capture_inventory_movement_cost()
  from public, anon, authenticated, service_role;

create or replace function public.reconcile_inventory_average_cost(
  p_operation_id uuid,
  p_product_id uuid,
  p_warehouse_id uuid,
  p_unit_cost numeric,
  p_reason text
)
returns table (
  reconciliation_id uuid,
  stock_id uuid,
  average_unit_cost numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_stock public.inventario_stock%rowtype;
  v_existing public.inventory_cost_reconciliations%rowtype;
  v_reconciliation public.inventory_cost_reconciliations%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;

  if p_operation_id is null
     or p_product_id is null
     or p_warehouse_id is null
     or p_unit_cost is null
     or p_unit_cost < 0
     or p_unit_cost <> round(p_unit_cost, 6)
     or v_reason is null
     or length(v_reason) < 3
     or length(v_reason) > 500 then
    raise exception 'Datos de conciliacion de costo invalidos.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'productId', p_product_id,
    'warehouseId', p_warehouse_id,
    'unitCost', p_unit_cost,
    'reason', v_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':inventory.cost.reconcile:' || p_operation_id::text,
      0
    )
  );

  select r.* into v_existing
  from public.inventory_cost_reconciliations as r
  where r.empresa_id = v_empresa_id
    and r.operation_id = p_operation_id;

  if v_existing.id is not null then
    if v_existing.request_payload <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;
    select s.* into v_stock
    from public.inventario_stock as s
    where s.empresa_id = v_empresa_id
      and s.producto_id = v_existing.product_id
      and s.bodega_id = v_existing.warehouse_id;
    return query select v_existing.id, v_stock.id, v_existing.new_unit_cost, true;
    return;
  end if;

  select s.* into v_stock
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_product_id
    and s.bodega_id = p_warehouse_id
  for update;

  if v_stock.id is null then
    raise exception 'Existencia no encontrada.' using errcode = '02000';
  end if;

  insert into public.inventory_cost_reconciliations (
    empresa_id,
    product_id,
    warehouse_id,
    previous_unit_cost,
    previous_status,
    new_unit_cost,
    reason,
    operation_id,
    request_payload,
    created_by
  ) values (
    v_empresa_id,
    p_product_id,
    p_warehouse_id,
    v_stock.average_unit_cost,
    v_stock.cost_status,
    p_unit_cost,
    v_reason,
    p_operation_id,
    v_request,
    v_user_id
  )
  returning * into v_reconciliation;

  update public.inventario_stock as s
  set
    average_unit_cost = p_unit_cost,
    cost_status = 'complete'
  where s.id = v_stock.id
    and s.empresa_id = v_empresa_id;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  ) values (
    v_empresa_id,
    v_user_id,
    'inventario_stock',
    v_stock.id,
    'reconcile_inventory_average_cost',
    jsonb_build_object(
      'averageUnitCost', v_stock.average_unit_cost,
      'costStatus', v_stock.cost_status
    ),
    jsonb_build_object(
      'averageUnitCost', p_unit_cost,
      'costStatus', 'complete',
      'reason', v_reason,
      'operationId', p_operation_id
    )
  );

  return query select v_reconciliation.id, v_stock.id, p_unit_cost, false;
end;
$$;

revoke all on function public.reconcile_inventory_average_cost(uuid, uuid, uuid, numeric, text)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_inventory_average_cost(uuid, uuid, uuid, numeric, text)
  to authenticated;

comment on column public.inventario_stock.average_unit_cost
  is 'Weighted-average unit cost for this product and warehouse. Null means historical value is incomplete.';
comment on column public.inventario_movimientos.unit_cost
  is 'Immutable cost snapshot used by this stock movement.';
comment on function public.reconcile_inventory_average_cost(uuid, uuid, uuid, numeric, text)
  is 'Audits and idempotently reconciles an incomplete warehouse average cost.';
