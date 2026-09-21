-- General stock reservations for backoffice sales with future delivery.

alter table public.ventas
  drop constraint if exists ventas_inventario_estado_check;
alter table public.ventas
  add constraint ventas_inventario_estado_check
  check (inventario_estado in ('pendiente', 'reservado', 'aplicado', 'parcial', 'no_aplica'));

create table if not exists public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sale_id uuid not null,
  sale_item_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,
  reserved_quantity numeric(14, 2) not null,
  consumed_quantity numeric(14, 2) not null default 0,
  status text not null default 'active',
  release_reason text,
  reserved_by uuid,
  reserved_at timestamptz not null default now(),
  consumed_by uuid,
  consumed_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_reservations_id_empresa_unique unique (id, empresa_id),
  constraint inventory_reservations_sale_item_unique unique (empresa_id, sale_item_id),
  constraint inventory_reservations_sale_empresa_fkey
    foreign key (sale_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete restrict,
  constraint inventory_reservations_sale_item_empresa_fkey
    foreign key (sale_item_id, empresa_id)
    references public.venta_items(id, empresa_id)
    on delete restrict,
  constraint inventory_reservations_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint inventory_reservations_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint inventory_reservations_reserved_by_empresa_fkey
    foreign key (reserved_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (reserved_by),
  constraint inventory_reservations_consumed_by_empresa_fkey
    foreign key (consumed_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (consumed_by),
  constraint inventory_reservations_released_by_empresa_fkey
    foreign key (released_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (released_by),
  constraint inventory_reservations_status_check
    check (status in ('active', 'consumed', 'released')),
  constraint inventory_reservations_quantities_check
    check (
      reserved_quantity > 0
      and consumed_quantity >= 0
      and consumed_quantity <= reserved_quantity
      and (
        (status = 'active' and consumed_quantity = 0 and consumed_at is null and released_at is null)
        or (status = 'consumed' and consumed_quantity = reserved_quantity and consumed_at is not null and released_at is null)
        or (status = 'released' and consumed_quantity = 0 and released_at is not null)
      )
    )
);

create index if not exists inventory_reservations_active_stock_idx
  on public.inventory_reservations (empresa_id, warehouse_id, product_id)
  where status = 'active';
create index if not exists inventory_reservations_sale_status_idx
  on public.inventory_reservations (empresa_id, sale_id, status);
create index if not exists inventory_reservations_sale_empresa_fkey_idx
  on public.inventory_reservations (sale_id, empresa_id);
create index if not exists inventory_reservations_sale_item_empresa_fkey_idx
  on public.inventory_reservations (sale_item_id, empresa_id);
create index if not exists inventory_reservations_product_empresa_fkey_idx
  on public.inventory_reservations (product_id, empresa_id);
create index if not exists inventory_reservations_warehouse_empresa_fkey_idx
  on public.inventory_reservations (warehouse_id, empresa_id);
create index if not exists inventory_reservations_reserved_by_empresa_fkey_idx
  on public.inventory_reservations (reserved_by, empresa_id);
create index if not exists inventory_reservations_consumed_by_empresa_fkey_idx
  on public.inventory_reservations (consumed_by, empresa_id);
create index if not exists inventory_reservations_released_by_empresa_fkey_idx
  on public.inventory_reservations (released_by, empresa_id);

alter table public.inventory_reservations enable row level security;
revoke all on table public.inventory_reservations from public, anon, authenticated;
grant select on table public.inventory_reservations to authenticated;

drop policy if exists inventory_reservations_select_permission
  on public.inventory_reservations;
create policy inventory_reservations_select_permission
on public.inventory_reservations for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('sales.orders.view'))
  and (
    (select public.current_user_has_permission('inventory.stock.view'))
    or (select public.current_user_has_permission('inventory.stock.adjust'))
  )
);

create or replace function public.guard_pos_stock_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := old.empresa_id;
  v_warehouse_id uuid := old.bodega_id;
  v_product_id uuid := old.producto_id;
  v_new_quantity numeric(14, 2);
  v_pos_reserved numeric(14, 2);
  v_sale_reserved numeric(14, 2);
begin
  if tg_op = 'UPDATE' then
    if new.cantidad >= old.cantidad then
      return new;
    end if;
    v_new_quantity := new.cantidad;
  else
    v_new_quantity := 0;
  end if;

  select coalesce(sum(a.allocated_quantity - a.consumed_quantity), 0)
  into v_pos_reserved
  from public.pos_stock_allocations as a
  join public.pos_sessions as s
    on s.id = a.session_id and s.empresa_id = a.empresa_id
  where a.empresa_id = v_company_id
    and a.warehouse_id = v_warehouse_id
    and a.product_id = v_product_id
    and a.released_at is null
    and s.status in ('open', 'pending_sync');

  select coalesce(sum(r.reserved_quantity), 0)
  into v_sale_reserved
  from public.inventory_reservations as r
  where r.empresa_id = v_company_id
    and r.warehouse_id = v_warehouse_id
    and r.product_id = v_product_id
    and r.status = 'active';

  if v_new_quantity < v_pos_reserved + v_sale_reserved then
    raise exception 'La salida consumiría existencias reservadas para POS o entregas pendientes.'
      using errcode = '22023';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_pos_stock_reservations_before_update
  on public.inventario_stock;
create trigger guard_pos_stock_reservations_before_update
before update of cantidad on public.inventario_stock
for each row execute function public.guard_pos_stock_reservations();

drop trigger if exists guard_stock_reservations_before_delete
  on public.inventario_stock;
create trigger guard_stock_reservations_before_delete
before delete on public.inventario_stock
for each row execute function public.guard_pos_stock_reservations();

revoke all on function public.guard_pos_stock_reservations()
  from public, anon, authenticated, service_role;

create or replace function public.reserve_sale_inventory(
  p_operation_id uuid,
  p_sale_id uuid,
  p_warehouse_id uuid
)
returns table (
  sale_id uuid,
  warehouse_id uuid,
  reserved_items integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_sale public.ventas%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_item record;
  v_request jsonb;
  v_pos_reserved numeric(14, 2);
  v_sale_reserved numeric(14, 2);
  v_available numeric(14, 2);
  v_reserved_items integer := 0;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit') then
    raise exception 'Permiso sales.orders.edit requerido.' using errcode = '42501';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_sale_id is null or p_warehouse_id is null then
    raise exception 'Operación, venta y bodega son requeridas.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('sale_id', p_sale_id, 'warehouse_id', p_warehouse_id);
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':sale.inventory.reserve:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'sale.inventory.reserve'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'sale_id')::uuid,
      (v_receipt.result_payload->>'warehouse_id')::uuid,
      (v_receipt.result_payload->>'reserved_items')::integer,
      true;
    return;
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = p_sale_id and v.empresa_id = v_company_id
  for update;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;
  if v_sale.estado not in ('confirmada', 'en_proceso') then
    raise exception 'La venta debe estar confirmada o en proceso.' using errcode = '22023';
  end if;
  if v_sale.inventario_estado in ('aplicado', 'no_aplica') then
    raise exception 'La venta ya cerró su paso de inventario.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.inventory_reservations as r
    where r.empresa_id = v_company_id and r.sale_id = p_sale_id and r.status = 'active'
  ) then
    raise exception 'La venta ya tiene inventario reservado.' using errcode = '23505';
  end if;
  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_warehouse_id and b.empresa_id = v_company_id and b.estado = 'activa'
  ) then
    raise exception 'Bodega activa no encontrada.' using errcode = '02000';
  end if;
  if exists (
    select 1 from public.inventory_counts as c
    where c.empresa_id = v_company_id
      and c.warehouse_id = p_warehouse_id
      and c.status = 'open'
  ) then
    raise exception 'La bodega tiene un conteo físico abierto.' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':sale.inventory.warehouse:' || p_warehouse_id::text, 0)
  );

  for v_item in
    select vi.id as sale_item_id, vi.producto_id, vi.cantidad, cp.nombre
    from public.venta_items as vi
    join public.catalogo_productos as cp
      on cp.id = vi.producto_id
     and cp.empresa_id = vi.empresa_id
     and cp.tipo = 'producto'
     and cp.estado = 'activo'
    where vi.empresa_id = v_company_id
      and vi.venta_id = p_sale_id
      and vi.producto_id is not null
    order by vi.orden, vi.created_at, vi.id
  loop
    insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
    values (v_company_id, v_item.producto_id, p_warehouse_id, 0)
    on conflict on constraint inventario_stock_empresa_producto_bodega_unique do nothing;

    select s.* into v_stock
    from public.inventario_stock as s
    where s.empresa_id = v_company_id
      and s.producto_id = v_item.producto_id
      and s.bodega_id = p_warehouse_id
    for update;

    select coalesce(sum(a.allocated_quantity - a.consumed_quantity), 0)
    into v_pos_reserved
    from public.pos_stock_allocations as a
    join public.pos_sessions as ps
      on ps.id = a.session_id and ps.empresa_id = a.empresa_id
    where a.empresa_id = v_company_id
      and a.warehouse_id = p_warehouse_id
      and a.product_id = v_item.producto_id
      and a.released_at is null
      and ps.status in ('open', 'pending_sync');

    select coalesce(sum(r.reserved_quantity), 0)
    into v_sale_reserved
    from public.inventory_reservations as r
    where r.empresa_id = v_company_id
      and r.warehouse_id = p_warehouse_id
      and r.product_id = v_item.producto_id
      and r.status = 'active';

    v_available := v_stock.cantidad - v_pos_reserved - v_sale_reserved;
    if v_available < v_item.cantidad then
      raise exception 'Stock disponible insuficiente para %. Disponible: %.', v_item.nombre, greatest(v_available, 0)
        using errcode = '22023';
    end if;

    insert into public.inventory_reservations (
      empresa_id,
      sale_id,
      sale_item_id,
      product_id,
      warehouse_id,
      reserved_quantity,
      status,
      reserved_by
    ) values (
      v_company_id,
      p_sale_id,
      v_item.sale_item_id,
      v_item.producto_id,
      p_warehouse_id,
      v_item.cantidad,
      'active',
      v_user_id
    )
    on conflict (empresa_id, sale_item_id) do update set
      sale_id = excluded.sale_id,
      product_id = excluded.product_id,
      warehouse_id = excluded.warehouse_id,
      reserved_quantity = excluded.reserved_quantity,
      consumed_quantity = 0,
      status = 'active',
      release_reason = null,
      reserved_by = v_user_id,
      reserved_at = now(),
      consumed_by = null,
      consumed_at = null,
      released_by = null,
      released_at = null,
      updated_at = now()
    where public.inventory_reservations.status = 'released';

    if not found then
      raise exception 'La línea de venta ya tiene una reserva no liberada.' using errcode = '23505';
    end if;

    v_reserved_items := v_reserved_items + 1;
  end loop;

  if v_reserved_items = 0 then
    raise exception 'La venta no tiene productos inventariables activos.' using errcode = '22023';
  end if;

  update public.ventas as v
  set
    inventario_estado = 'reservado',
    entrega_estado = 'reservado',
    actualizado_por = v_user_id
  where v.id = p_sale_id and v.empresa_id = v_company_id;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'sale.inventory.reserve',
    p_operation_id::text,
    v_request,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'warehouse_id', p_warehouse_id,
      'reserved_items', v_reserved_items
    ),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id,
    v_user_id,
    'ventas',
    p_sale_id,
    'reserve_sale_inventory',
    jsonb_build_object('warehouse_id', p_warehouse_id, 'reserved_items', v_reserved_items)
  );

  return query select p_sale_id, p_warehouse_id, v_reserved_items, false;
end;
$$;

create or replace function public.release_sale_inventory_reservation(
  p_operation_id uuid,
  p_sale_id uuid,
  p_reason text default null
)
returns table (
  sale_id uuid,
  released_items integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_sale public.ventas%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_request jsonb;
  v_released integer;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit')
     or not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permisos de venta e inventario requeridos.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_sale_id is null then
    raise exception 'Operación y venta son requeridas.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'sale_id', p_sale_id,
    'reason', nullif(btrim(coalesce(p_reason, '')), '')
  );
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':sale.inventory.release:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'sale.inventory.release'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'sale_id')::uuid,
      (v_receipt.result_payload->>'released_items')::integer,
      true;
    return;
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = p_sale_id and v.empresa_id = v_company_id
  for update;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;
  if v_sale.inventario_estado = 'aplicado' then
    raise exception 'La salida física ya fue aplicada.' using errcode = '22023';
  end if;

  update public.inventory_reservations as r
  set
    status = 'released',
    release_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Liberación manual'),
    released_by = v_user_id,
    released_at = now(),
    updated_at = now()
  where r.empresa_id = v_company_id
    and r.sale_id = p_sale_id
    and r.status = 'active';
  get diagnostics v_released = row_count;

  if v_released = 0 then
    raise exception 'La venta no tiene reservas activas.' using errcode = '02000';
  end if;

  update public.ventas as v
  set
    inventario_estado = 'pendiente',
    entrega_estado = case when v.entrega_estado = 'reservado' then 'pendiente' else v.entrega_estado end,
    actualizado_por = v_user_id
  where v.id = p_sale_id and v.empresa_id = v_company_id;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'sale.inventory.release',
    p_operation_id::text,
    v_request,
    jsonb_build_object('sale_id', p_sale_id, 'released_items', v_released),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id,
    v_user_id,
    'ventas',
    p_sale_id,
    'release_sale_inventory_reservation',
    jsonb_build_object('released_items', v_released, 'reason', p_reason)
  );

  return query select p_sale_id, v_released, false;
end;
$$;

create or replace function public.apply_sale_inventory_atomic(
  p_operation_id uuid,
  p_sale_id uuid,
  p_warehouse_id uuid
)
returns table (
  sale_id uuid,
  sale_number text,
  inventory_status text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_sale public.ventas%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_result record;
  v_request jsonb;
  v_inventory_items integer;
  v_active_reservations integer;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit')
     or not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permisos de venta e inventario requeridos.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_sale_id is null or p_warehouse_id is null then
    raise exception 'Operación, venta y bodega son requeridas.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('sale_id', p_sale_id, 'warehouse_id', p_warehouse_id);
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':sale.inventory.apply:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'sale.inventory.apply'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'sale_id')::uuid,
      v_receipt.result_payload->>'sale_number',
      v_receipt.result_payload->>'inventory_status',
      true;
    return;
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = p_sale_id and v.empresa_id = v_company_id
  for update;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  select count(*)::integer into v_inventory_items
  from public.venta_items as vi
  join public.catalogo_productos as cp
    on cp.id = vi.producto_id
   and cp.empresa_id = vi.empresa_id
   and cp.tipo = 'producto'
   and cp.estado = 'activo'
  where vi.empresa_id = v_company_id and vi.venta_id = p_sale_id;

  select count(*)::integer into v_active_reservations
  from public.inventory_reservations as r
  where r.empresa_id = v_company_id and r.sale_id = p_sale_id and r.status = 'active';

  if v_active_reservations > 0 then
    if v_active_reservations <> v_inventory_items
       or exists (
         select 1 from public.inventory_reservations as r
         where r.empresa_id = v_company_id
           and r.sale_id = p_sale_id
           and r.status = 'active'
           and r.warehouse_id <> p_warehouse_id
       ) then
      raise exception 'La reserva activa no coincide con la bodega o con todas las líneas de la venta.'
        using errcode = '22023';
    end if;

    update public.inventory_reservations as r
    set
      status = 'consumed',
      consumed_quantity = r.reserved_quantity,
      consumed_by = v_user_id,
      consumed_at = now(),
      updated_at = now()
    where r.empresa_id = v_company_id
      and r.sale_id = p_sale_id
      and r.status = 'active';
  end if;

  select * into v_result
  from public.aplicar_salida_inventario_venta(p_sale_id, p_warehouse_id);

  update public.ventas as v
  set entrega_estado = case when v.entrega_estado = 'reservado' then 'preparacion' else v.entrega_estado end
  where v.id = p_sale_id and v.empresa_id = v_company_id;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'sale.inventory.apply',
    p_operation_id::text,
    v_request,
    jsonb_build_object(
      'sale_id', v_result.venta_id,
      'sale_number', v_result.numero,
      'inventory_status', v_result.inventario_estado
    ),
    v_user_id
  );

  return query select
    v_result.venta_id,
    v_result.numero,
    v_result.inventario_estado,
    false;
end;
$$;

create or replace function public.release_sale_reservations_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'cancelada' and old.estado is distinct from new.estado then
    update public.inventory_reservations as r
    set
      status = 'released',
      release_reason = 'Venta cancelada',
      released_by = auth.uid(),
      released_at = now(),
      updated_at = now()
    where r.empresa_id = new.empresa_id
      and r.sale_id = new.id
      and r.status = 'active';

    if new.inventario_estado = 'reservado' then
      new.inventario_estado := 'pendiente';
    end if;
    if new.entrega_estado = 'reservado' then
      new.entrega_estado := 'no_aplica';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists release_sale_reservations_before_cancel
  on public.ventas;
create trigger release_sale_reservations_before_cancel
before update of estado on public.ventas
for each row execute function public.release_sale_reservations_on_cancel();

revoke all on function public.release_sale_reservations_on_cancel()
  from public, anon, authenticated, service_role;

create or replace function public.obtener_resumen_inventario_venta(p_venta_id uuid)
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
  v_company_id uuid := public.current_empresa_id();
  v_sale public.ventas%rowtype;
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.view') then
    raise exception 'Permiso sales.orders.view requerido.' using errcode = '42501';
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = p_venta_id and v.empresa_id = v_company_id;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  return query
  select
    vi.venta_id,
    vi.id,
    vi.producto_id,
    cp.nombre,
    cp.codigo,
    vi.descripcion,
    vi.cantidad,
    reservation.warehouse_id,
    reservation.warehouse_name,
    case
      when cp.id is null or cp.tipo <> 'producto' then null
      when reservation.status = 'active' then reservation.reserved_quantity
      else coalesce(available.available_quantity, 0)
    end,
    (cp.id is not null and cp.tipo = 'producto'),
    case
      when cp.id is null or cp.tipo <> 'producto' then true
      when reservation.status = 'active' then reservation.reserved_quantity >= vi.cantidad
      else coalesce(available.available_quantity, 0) >= vi.cantidad
    end,
    (
      v_sale.inventario_estado = 'aplicado'
      or exists (
        select 1 from public.inventario_movimientos as im
        where im.empresa_id = v_company_id
          and im.referencia_tipo = 'venta'
          and im.referencia_id = p_venta_id
      )
    )
  from public.venta_items as vi
  left join public.catalogo_productos as cp
    on cp.id = vi.producto_id and cp.empresa_id = v_company_id
  left join lateral (
    select
      r.warehouse_id,
      b.nombre as warehouse_name,
      r.reserved_quantity,
      r.status
    from public.inventory_reservations as r
    join public.inventario_bodegas as b
      on b.id = r.warehouse_id and b.empresa_id = r.empresa_id
    where r.empresa_id = v_company_id
      and r.sale_item_id = vi.id
      and r.status in ('active', 'consumed')
    order by case when r.status = 'active' then 0 else 1 end, r.updated_at desc
    limit 1
  ) as reservation on true
  left join lateral (
    select sum(greatest(
      s.cantidad
      - coalesce((
          select sum(a.allocated_quantity - a.consumed_quantity)
          from public.pos_stock_allocations as a
          join public.pos_sessions as ps
            on ps.id = a.session_id and ps.empresa_id = a.empresa_id
          where a.empresa_id = s.empresa_id
            and a.warehouse_id = s.bodega_id
            and a.product_id = s.producto_id
            and a.released_at is null
            and ps.status in ('open', 'pending_sync')
        ), 0)
      - coalesce((
          select sum(r.reserved_quantity)
          from public.inventory_reservations as r
          where r.empresa_id = s.empresa_id
            and r.warehouse_id = s.bodega_id
            and r.product_id = s.producto_id
            and r.status = 'active'
            and r.sale_id <> p_venta_id
        ), 0),
      0
    )) as available_quantity
    from public.inventario_stock as s
    join public.inventario_bodegas as b
      on b.id = s.bodega_id and b.empresa_id = s.empresa_id and b.estado = 'activa'
    where s.empresa_id = v_company_id and s.producto_id = vi.producto_id
  ) as available on true
  where vi.empresa_id = v_company_id and vi.venta_id = p_venta_id
  order by vi.orden, vi.created_at;
end;
$$;

revoke all on function public.reserve_sale_inventory(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.release_sale_inventory_reservation(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_sale_inventory_atomic(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.aplicar_salida_inventario_venta(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.reserve_sale_inventory(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.release_sale_inventory_reservation(uuid, uuid, text)
  to authenticated;
grant execute on function public.apply_sale_inventory_atomic(uuid, uuid, uuid)
  to authenticated;

comment on table public.inventory_reservations
  is 'Logical stock reserved for confirmed backoffice sales until physical dispatch or release.';
comment on function public.reserve_sale_inventory(uuid, uuid, uuid)
  is 'Reserves all physical sale lines exactly once while respecting POS and other sales.';
comment on function public.apply_sale_inventory_atomic(uuid, uuid, uuid)
  is 'Consumes any sale reservation and applies the physical stock exit idempotently.';
