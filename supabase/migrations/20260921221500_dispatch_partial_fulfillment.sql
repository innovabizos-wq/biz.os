-- Partial dispatch fulfillment and physical returns linked to commercial returns.

alter table public.despachos
  drop constraint if exists despachos_estado_check;
alter table public.despachos
  add constraint despachos_estado_check
  check (estado in (
    'pendiente', 'preparando', 'listo', 'en_ruta', 'parcial',
    'entregado', 'fallido', 'cancelado'
  ));

alter table public.inventory_reservations
  drop constraint if exists inventory_reservations_quantities_check;
alter table public.inventory_reservations
  add constraint inventory_reservations_quantities_check
  check (
    reserved_quantity > 0
    and consumed_quantity >= 0
    and consumed_quantity <= reserved_quantity
    and (
      (
        status = 'active'
        and consumed_quantity < reserved_quantity
        and consumed_at is null
        and released_at is null
      )
      or (
        status = 'consumed'
        and consumed_quantity = reserved_quantity
        and consumed_at is not null
        and released_at is null
      )
      or (
        status = 'released'
        and consumed_quantity = 0
        and released_at is not null
      )
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

  select coalesce(sum(r.reserved_quantity - r.consumed_quantity), 0)
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

create table if not exists public.dispatch_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  despacho_id uuid not null,
  sale_item_id uuid not null,
  product_id uuid,
  description text not null,
  ordered_quantity numeric(14, 2) not null,
  delivered_quantity numeric(14, 2) not null default 0,
  returned_quantity numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dispatch_items_id_empresa_unique unique (id, empresa_id),
  constraint dispatch_items_dispatch_sale_item_unique unique (despacho_id, sale_item_id),
  constraint dispatch_items_dispatch_empresa_fkey
    foreign key (despacho_id, empresa_id)
    references public.despachos(id, empresa_id)
    on delete cascade,
  constraint dispatch_items_sale_item_empresa_fkey
    foreign key (sale_item_id, empresa_id)
    references public.venta_items(id, empresa_id)
    on delete restrict,
  constraint dispatch_items_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint dispatch_items_quantities_check
    check (
      ordered_quantity > 0
      and delivered_quantity >= 0
      and returned_quantity >= 0
      and returned_quantity <= delivered_quantity
      and delivered_quantity - returned_quantity <= ordered_quantity
    )
);

create index if not exists dispatch_items_empresa_dispatch_idx
  on public.dispatch_items (empresa_id, despacho_id, created_at);
create index if not exists dispatch_items_dispatch_empresa_fkey_idx
  on public.dispatch_items (despacho_id, empresa_id);
create index if not exists dispatch_items_sale_item_empresa_fkey_idx
  on public.dispatch_items (sale_item_id, empresa_id);
create index if not exists dispatch_items_product_empresa_fkey_idx
  on public.dispatch_items (product_id, empresa_id);

drop trigger if exists set_dispatch_items_updated_at on public.dispatch_items;
create trigger set_dispatch_items_updated_at
before update on public.dispatch_items
for each row execute function public.set_updated_at();

create table if not exists public.dispatch_fulfillments (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  despacho_id uuid not null,
  operation_id uuid not null,
  event_type text not null,
  warehouse_id uuid,
  sales_return_id uuid,
  receiver_name text,
  result text,
  request_payload jsonb not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),

  constraint dispatch_fulfillments_id_empresa_unique unique (id, empresa_id),
  constraint dispatch_fulfillments_empresa_operation_unique unique (empresa_id, operation_id),
  constraint dispatch_fulfillments_event_type_check check (event_type in ('delivery', 'return')),
  constraint dispatch_fulfillments_request_object_check check (jsonb_typeof(request_payload) = 'object'),
  constraint dispatch_fulfillments_dispatch_empresa_fkey
    foreign key (despacho_id, empresa_id)
    references public.despachos(id, empresa_id)
    on delete restrict,
  constraint dispatch_fulfillments_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint dispatch_fulfillments_sales_return_empresa_fkey
    foreign key (sales_return_id, empresa_id)
    references public.sales_returns(id, empresa_id)
    on delete restrict,
  constraint dispatch_fulfillments_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete restrict
);

create index if not exists dispatch_fulfillments_company_dispatch_idx
  on public.dispatch_fulfillments (empresa_id, despacho_id, created_at desc);
create index if not exists dispatch_fulfillments_dispatch_empresa_fkey_idx
  on public.dispatch_fulfillments (despacho_id, empresa_id);
create index if not exists dispatch_fulfillments_warehouse_empresa_fkey_idx
  on public.dispatch_fulfillments (warehouse_id, empresa_id);
create index if not exists dispatch_fulfillments_sales_return_empresa_fkey_idx
  on public.dispatch_fulfillments (sales_return_id, empresa_id);
create index if not exists dispatch_fulfillments_created_by_empresa_fkey_idx
  on public.dispatch_fulfillments (created_by, empresa_id);

create table if not exists public.dispatch_fulfillment_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fulfillment_id uuid not null,
  dispatch_item_id uuid not null,
  quantity numeric(14, 2) not null,
  inventory_movement_id uuid,
  created_at timestamptz not null default now(),

  constraint dispatch_fulfillment_items_id_empresa_unique unique (id, empresa_id),
  constraint dispatch_fulfillment_items_event_line_unique unique (fulfillment_id, dispatch_item_id),
  constraint dispatch_fulfillment_items_quantity_check check (quantity > 0),
  constraint dispatch_fulfillment_items_fulfillment_empresa_fkey
    foreign key (fulfillment_id, empresa_id)
    references public.dispatch_fulfillments(id, empresa_id)
    on delete cascade,
  constraint dispatch_fulfillment_items_dispatch_item_empresa_fkey
    foreign key (dispatch_item_id, empresa_id)
    references public.dispatch_items(id, empresa_id)
    on delete restrict,
  constraint dispatch_fulfillment_items_movement_fkey
    foreign key (inventory_movement_id)
    references public.inventario_movimientos(id)
    on delete restrict
);

create index if not exists dispatch_fulfillment_items_company_event_idx
  on public.dispatch_fulfillment_items (empresa_id, fulfillment_id);
create index if not exists dispatch_fulfillment_items_fulfillment_empresa_fkey_idx
  on public.dispatch_fulfillment_items (fulfillment_id, empresa_id);
create index if not exists dispatch_fulfillment_items_dispatch_item_empresa_fkey_idx
  on public.dispatch_fulfillment_items (dispatch_item_id, empresa_id);
create index if not exists dispatch_fulfillment_items_movement_fkey_idx
  on public.dispatch_fulfillment_items (inventory_movement_id)
  where inventory_movement_id is not null;

alter table public.dispatch_items enable row level security;
alter table public.dispatch_fulfillments enable row level security;
alter table public.dispatch_fulfillment_items enable row level security;

revoke all on table public.dispatch_items, public.dispatch_fulfillments,
  public.dispatch_fulfillment_items from public, anon, authenticated;
grant select on table public.dispatch_items, public.dispatch_fulfillments,
  public.dispatch_fulfillment_items to authenticated;

create policy dispatch_items_select_permission
on public.dispatch_items for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('dispatch.orders.view'))
);

create policy dispatch_fulfillments_select_permission
on public.dispatch_fulfillments for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('dispatch.orders.view'))
);

create policy dispatch_fulfillment_items_select_permission
on public.dispatch_fulfillment_items for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('dispatch.orders.view'))
);

create or replace function public.initialize_dispatch_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dispatch_items (
    empresa_id, despacho_id, sale_item_id, product_id, description,
    ordered_quantity, delivered_quantity
  )
  select
    new.empresa_id,
    new.id,
    vi.id,
    vi.producto_id,
    vi.descripcion,
    vi.cantidad,
    case when new.estado = 'entregado' then vi.cantidad else 0 end
  from public.venta_items as vi
  where vi.empresa_id = new.empresa_id
    and vi.venta_id = new.venta_id
  on conflict on constraint dispatch_items_dispatch_sale_item_unique do nothing;
  return new;
end;
$$;

drop trigger if exists initialize_dispatch_items_after_insert on public.despachos;
create trigger initialize_dispatch_items_after_insert
after insert on public.despachos
for each row execute function public.initialize_dispatch_items();

insert into public.dispatch_items (
  empresa_id, despacho_id, sale_item_id, product_id, description,
  ordered_quantity, delivered_quantity
)
select
  d.empresa_id,
  d.id,
  vi.id,
  vi.producto_id,
  vi.descripcion,
  vi.cantidad,
  case when d.estado = 'entregado' then vi.cantidad else 0 end
from public.despachos as d
join public.venta_items as vi
  on vi.venta_id = d.venta_id and vi.empresa_id = d.empresa_id
on conflict on constraint dispatch_items_dispatch_sale_item_unique do nothing;

create or replace function public.record_dispatch_fulfillment(
  p_operation_id uuid,
  p_dispatch_id uuid,
  p_event_type text,
  p_items jsonb,
  p_warehouse_id uuid default null,
  p_receiver_name text default null,
  p_result text default null
)
returns table (
  fulfillment_id uuid,
  dispatch_status text,
  sale_delivery_status text,
  sales_return_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_dispatch public.despachos%rowtype;
  v_sale public.ventas%rowtype;
  v_existing public.dispatch_fulfillments%rowtype;
  v_fulfillment public.dispatch_fulfillments%rowtype;
  v_dispatch_item public.dispatch_items%rowtype;
  v_sale_item public.venta_items%rowtype;
  v_reservation public.inventory_reservations%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_event_item public.dispatch_fulfillment_items%rowtype;
  v_movement public.inventario_movimientos%rowtype;
  v_sales_return public.sales_returns%rowtype;
  v_item jsonb;
  v_request jsonb;
  v_normalized_items jsonb;
  v_quantity numeric(14, 2);
  v_available numeric(14, 2);
  v_warehouse_id uuid;
  v_is_product boolean;
  v_all_delivered boolean;
  v_any_delivered boolean;
  v_any_product boolean;
  v_all_product_delivered boolean;
  v_delivery_status text;
  v_dispatch_status text;
  v_return_items jsonb := '[]'::jsonb;
  v_sequence bigint;
  v_prior_quantity numeric(14, 2);
  v_prior_subtotal numeric(14, 2);
  v_prior_discount numeric(14, 2);
  v_prior_tax numeric(14, 2);
  v_prior_total numeric(14, 2);
  v_ratio numeric;
  v_line_subtotal numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_any_return_inventory boolean := false;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('dispatch.orders.status.change') then
    raise exception 'Permiso dispatch.orders.status.change requerido.' using errcode = '42501';
  end if;
  if p_event_type not in ('delivery', 'return') then
    raise exception 'Tipo de evento operativo inválido.' using errcode = '22023';
  end if;
  if p_operation_id is null or p_dispatch_id is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Operación, despacho y líneas son requeridos.' using errcode = '22023';
  end if;
  if p_event_type = 'return' and (
    not public.current_user_has_permission('sales.orders.edit')
    or not public.current_user_has_permission('inventory.stock.adjust')
  ) then
    raise exception 'Permisos de ventas e inventario requeridos para la devolución.' using errcode = '42501';
  end if;
  if p_event_type = 'return' and p_warehouse_id is null then
    raise exception 'La bodega que recibe la devolución es requerida.' using errcode = '22023';
  end if;

  begin
    if exists (
      select 1
      from jsonb_array_elements(p_items) as entry(item)
      where jsonb_typeof(item) <> 'object'
        or nullif(item->>'dispatchItemId', '') is null
        or nullif(item->>'quantity', '') is null
        or (item->>'quantity')::numeric <= 0
        or (item->>'quantity')::numeric <> round((item->>'quantity')::numeric, 2)
    ) or (
      select count(*) <> count(distinct item->>'dispatchItemId')
      from jsonb_array_elements(p_items) as entry(item)
    ) then
      raise exception 'Líneas operativas inválidas.' using errcode = '22023';
    end if;

    select jsonb_agg(
      jsonb_build_object(
        'dispatchItemId', (item->>'dispatchItemId')::uuid,
        'quantity', round((item->>'quantity')::numeric, 2)
      ) order by item->>'dispatchItemId'
    ) into v_normalized_items
    from jsonb_array_elements(p_items) as entry(item);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Líneas operativas inválidas.' using errcode = '22023';
  end;

  v_request := jsonb_build_object(
    'dispatchId', p_dispatch_id,
    'eventType', p_event_type,
    'warehouseId', p_warehouse_id,
    'receiverName', nullif(btrim(coalesce(p_receiver_name, '')), ''),
    'result', nullif(btrim(coalesce(p_result, '')), ''),
    'items', v_normalized_items
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_company_id::text || ':dispatch.fulfillment:' || p_operation_id::text, 0)
  );

  select df.* into v_existing
  from public.dispatch_fulfillments as df
  where df.empresa_id = v_company_id and df.operation_id = p_operation_id;
  if v_existing.id is not null then
    if v_existing.request_payload <> v_request then
      raise exception 'La operación ya fue usada con contenido diferente.' using errcode = '23505';
    end if;
    select d.estado, v.entrega_estado
    into v_dispatch_status, v_delivery_status
    from public.despachos as d
    join public.ventas as v on v.id = d.venta_id and v.empresa_id = d.empresa_id
    where d.id = v_existing.despacho_id and d.empresa_id = v_company_id;
    return query select v_existing.id, v_dispatch_status, v_delivery_status,
      v_existing.sales_return_id, true;
    return;
  end if;

  select d.* into v_dispatch
  from public.despachos as d
  where d.id = p_dispatch_id and d.empresa_id = v_company_id
  for update;
  if v_dispatch.id is null then
    raise exception 'Despacho no encontrado.' using errcode = '02000';
  end if;
  if v_dispatch.responsable_id is not null
     and v_dispatch.responsable_id <> v_user_id
     and not public.current_user_has_permission('dispatch.orders.edit') then
    raise exception 'El despacho está asignado a otra persona.' using errcode = '42501';
  end if;
  if p_event_type = 'delivery' and v_dispatch.estado not in ('listo', 'en_ruta', 'parcial') then
    raise exception 'El despacho no admite entregas en su estado actual.' using errcode = '22023';
  end if;
  if p_event_type = 'return' and v_dispatch.estado not in ('parcial', 'entregado') then
    raise exception 'El despacho no admite devoluciones operativas en su estado actual.' using errcode = '22023';
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = v_dispatch.venta_id and v.empresa_id = v_company_id
  for update;
  if v_sale.id is null or v_sale.estado = 'cancelada' then
    raise exception 'Venta no disponible.' using errcode = '02000';
  end if;

  if p_warehouse_id is not null and not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_warehouse_id and b.empresa_id = v_company_id and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  -- Validate and lock every requested line before creating effects.
  for v_item in select value from jsonb_array_elements(v_normalized_items)
  loop
    select di.* into v_dispatch_item
    from public.dispatch_items as di
    where di.id = (v_item->>'dispatchItemId')::uuid
      and di.despacho_id = p_dispatch_id
      and di.empresa_id = v_company_id
    for update;
    if v_dispatch_item.id is null then
      raise exception 'Línea de despacho no encontrada.' using errcode = '02000';
    end if;
    v_quantity := (v_item->>'quantity')::numeric;
    v_available := case when p_event_type = 'delivery'
      then v_dispatch_item.ordered_quantity
        - (v_dispatch_item.delivered_quantity - v_dispatch_item.returned_quantity)
      else v_dispatch_item.delivered_quantity - v_dispatch_item.returned_quantity
    end;
    if v_quantity > v_available then
      raise exception 'La cantidad supera lo disponible para la línea %.', v_dispatch_item.description
        using errcode = '22023';
    end if;
  end loop;

  insert into public.dispatch_fulfillments (
    empresa_id, despacho_id, operation_id, event_type, warehouse_id,
    receiver_name, result, request_payload, created_by
  ) values (
    v_company_id, p_dispatch_id, p_operation_id, p_event_type, p_warehouse_id,
    nullif(btrim(coalesce(p_receiver_name, '')), ''),
    nullif(btrim(coalesce(p_result, '')), ''), v_request, v_user_id
  ) returning * into v_fulfillment;

  if p_event_type = 'delivery' then
    for v_item in select value from jsonb_array_elements(v_normalized_items)
    loop
      select di.* into v_dispatch_item
      from public.dispatch_items as di
      where di.id = (v_item->>'dispatchItemId')::uuid and di.empresa_id = v_company_id
      for update;
      v_quantity := (v_item->>'quantity')::numeric;
      select vi.* into v_sale_item
      from public.venta_items as vi
      where vi.id = v_dispatch_item.sale_item_id and vi.empresa_id = v_company_id;
      select coalesce(cp.tipo = 'producto' and cp.estado = 'activo', false)
      into v_is_product
      from public.catalogo_productos as cp
      where cp.id = v_dispatch_item.product_id and cp.empresa_id = v_company_id;
      v_is_product := coalesce(v_is_product, false);

      insert into public.dispatch_fulfillment_items (
        empresa_id, fulfillment_id, dispatch_item_id, quantity
      ) values (v_company_id, v_fulfillment.id, v_dispatch_item.id, v_quantity)
      returning * into v_event_item;

      if v_is_product and v_sale.inventario_estado <> 'aplicado' then
        select r.* into v_reservation
        from public.inventory_reservations as r
        where r.empresa_id = v_company_id
          and r.sale_item_id = v_dispatch_item.sale_item_id
          and r.status = 'active'
        for update;

        v_warehouse_id := coalesce(v_reservation.warehouse_id, p_warehouse_id);
        if v_warehouse_id is null then
          raise exception 'La entrega requiere una bodega o una reserva activa.' using errcode = '22023';
        end if;
        if p_warehouse_id is not null and v_reservation.id is not null
           and p_warehouse_id <> v_reservation.warehouse_id then
          raise exception 'La bodega no coincide con la reserva de la venta.' using errcode = '22023';
        end if;
        if v_reservation.id is not null
           and v_quantity > v_reservation.reserved_quantity - v_reservation.consumed_quantity then
          raise exception 'La cantidad supera la reserva disponible.' using errcode = '22023';
        end if;

        -- Reduce the logical reservation before the guarded stock update. Both
        -- changes remain inside this transaction and roll back together.
        if v_reservation.id is not null then
          update public.inventory_reservations as r
          set consumed_quantity = r.consumed_quantity + v_quantity,
              status = case
                when r.consumed_quantity + v_quantity = r.reserved_quantity
                  then 'consumed' else 'active' end,
              consumed_by = case
                when r.consumed_quantity + v_quantity = r.reserved_quantity
                  then v_user_id else null end,
              consumed_at = case
                when r.consumed_quantity + v_quantity = r.reserved_quantity
                  then now() else null end,
              updated_at = now()
          where r.id = v_reservation.id;
        end if;

        insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
        values (v_company_id, v_dispatch_item.product_id, v_warehouse_id, 0)
        on conflict on constraint inventario_stock_empresa_producto_bodega_unique do nothing;
        select s.* into v_stock
        from public.inventario_stock as s
        where s.empresa_id = v_company_id
          and s.producto_id = v_dispatch_item.product_id
          and s.bodega_id = v_warehouse_id
        for update;
        if v_stock.cantidad < v_quantity then
          raise exception 'Stock insuficiente para %.', v_dispatch_item.description using errcode = '22023';
        end if;

        update public.inventario_stock as s
        set cantidad = v_stock.cantidad - v_quantity
        where s.id = v_stock.id;
        insert into public.inventario_movimientos (
          empresa_id, producto_id, bodega_id, tipo, cantidad,
          cantidad_anterior, cantidad_nueva, motivo, referencia_tipo,
          referencia_id, source_item_id, created_by
        ) values (
          v_company_id, v_dispatch_item.product_id, v_warehouse_id, 'salida',
          v_quantity, v_stock.cantidad, v_stock.cantidad - v_quantity,
          'Entrega parcial del despacho ' || v_dispatch.numero,
          'venta', v_sale.id, v_sale_item.id, v_user_id
        ) returning * into v_movement;
        update public.dispatch_fulfillment_items as dfi
        set inventory_movement_id = v_movement.id
        where dfi.id = v_event_item.id;
      end if;

      update public.dispatch_items as di
      set delivered_quantity = di.delivered_quantity + v_quantity
      where di.id = v_dispatch_item.id;
    end loop;
  else
    -- Create the commercial return in the same transaction. Its physical effect is
    -- processed immediately; financial and fiscal effects remain pending.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_company_id::text || ':sales.return.number', 0)
    );
    select coalesce(max((substring(sr.number from '[0-9]+$'))::bigint), 0) + 1
    into v_sequence
    from public.sales_returns as sr
    where sr.empresa_id = v_company_id;

    insert into public.sales_returns (
      empresa_id, sale_id, number, reason, currency_code, subtotal_amount,
      discount_amount, tax_amount, total_amount, financial_status,
      inventory_status, fiscal_status, creation_operation_id, creation_request,
      created_by
    ) values (
      v_company_id, v_sale.id, 'DEV-' || lpad(v_sequence::text, 8, '0'),
      coalesce(nullif(btrim(coalesce(p_result, '')), ''), 'Devolución operativa desde despacho'),
      v_sale.moneda, 0, 0, 0, 0, 'pending', 'pending',
      case when exists (
        select 1 from public.fiscal_documents as fd
        where fd.empresa_id = v_company_id and fd.sale_id = v_sale.id
          and fd.document_type_code in ('01', '04')
          and fd.status not in ('error_validation', 'cancelled_internal', 'replaced')
      ) then 'pending' else 'not_required' end,
      p_operation_id,
      jsonb_build_object(
        'saleId', v_sale.id,
        'reason', coalesce(nullif(btrim(coalesce(p_result, '')), ''), 'Devolución operativa desde despacho'),
        'source', 'dispatch',
        'dispatchId', p_dispatch_id,
        'items', v_normalized_items
      ),
      v_user_id
    ) returning * into v_sales_return;

    for v_item in select value from jsonb_array_elements(v_normalized_items)
    loop
      select di.* into v_dispatch_item
      from public.dispatch_items as di
      where di.id = (v_item->>'dispatchItemId')::uuid and di.empresa_id = v_company_id
      for update;
      v_quantity := (v_item->>'quantity')::numeric;
      select vi.* into v_sale_item
      from public.venta_items as vi
      where vi.id = v_dispatch_item.sale_item_id and vi.empresa_id = v_company_id;

      select
        coalesce(sum(sri.quantity), 0), coalesce(sum(sri.subtotal_amount), 0),
        coalesce(sum(sri.discount_amount), 0), coalesce(sum(sri.tax_amount), 0),
        coalesce(sum(sri.total_amount), 0)
      into v_prior_quantity, v_prior_subtotal, v_prior_discount, v_prior_tax, v_prior_total
      from public.sales_return_items as sri
      join public.sales_returns as sr
        on sr.id = sri.return_id and sr.empresa_id = sri.empresa_id
      where sri.empresa_id = v_company_id
        and sri.sale_item_id = v_sale_item.id
        and sr.status <> 'cancelled';
      if v_prior_quantity + v_quantity > v_sale_item.cantidad then
        raise exception 'La devolución supera la cantidad vendida.' using errcode = '22023';
      end if;
      if v_prior_quantity + v_quantity = v_sale_item.cantidad then
        v_line_subtotal := v_sale_item.subtotal - v_prior_subtotal;
        v_line_discount := v_sale_item.descuento - v_prior_discount;
        v_line_tax := v_sale_item.impuesto_monto - v_prior_tax;
        v_line_total := v_sale_item.total - v_prior_total;
      else
        v_ratio := v_quantity / v_sale_item.cantidad;
        v_line_subtotal := round(v_sale_item.subtotal * v_ratio, 2);
        v_line_discount := round(v_sale_item.descuento * v_ratio, 2);
        v_line_tax := round(v_sale_item.impuesto_monto * v_ratio, 2);
        v_line_total := round(v_sale_item.total * v_ratio, 2);
      end if;
      select coalesce(cp.tipo = 'producto', false)
      into v_is_product
      from public.catalogo_productos as cp
      where cp.id = v_dispatch_item.product_id and cp.empresa_id = v_company_id;
      v_is_product := coalesce(v_is_product, false);
      v_any_return_inventory := v_any_return_inventory or v_is_product;

      insert into public.sales_return_items (
        empresa_id, return_id, sale_item_id, product_id, description, quantity,
        unit_price, subtotal_amount, discount_amount, tax_amount, total_amount,
        requires_inventory
      ) values (
        v_company_id, v_sales_return.id, v_sale_item.id, v_sale_item.producto_id,
        v_sale_item.descripcion, v_quantity, v_sale_item.precio_unitario,
        v_line_subtotal, v_line_discount, v_line_tax, v_line_total, v_is_product
      );
      insert into public.dispatch_fulfillment_items (
        empresa_id, fulfillment_id, dispatch_item_id, quantity
      ) values (v_company_id, v_fulfillment.id, v_dispatch_item.id, v_quantity);
      update public.dispatch_items as di
      set returned_quantity = di.returned_quantity + v_quantity
      where di.id = v_dispatch_item.id;
      v_subtotal := v_subtotal + v_line_subtotal;
      v_discount := v_discount + v_line_discount;
      v_tax := v_tax + v_line_tax;
      v_total := v_total + v_line_total;
    end loop;

    update public.sales_returns as sr
    set subtotal_amount = v_subtotal,
        discount_amount = v_discount,
        tax_amount = v_tax,
        total_amount = v_total,
        financial_status = case when v_total = 0 then 'not_required' else 'pending' end,
        inventory_status = case when v_any_return_inventory then 'pending' else 'not_required' end
    where sr.id = v_sales_return.id;

    if v_any_return_inventory then
      perform * from public.apply_sales_return_inventory(
        p_operation_id, v_sales_return.id, p_warehouse_id
      );
    end if;
    update public.dispatch_fulfillments as df
    set sales_return_id = v_sales_return.id
    where df.id = v_fulfillment.id
    returning * into v_fulfillment;
  end if;

  select
    bool_and(di.delivered_quantity - di.returned_quantity >= di.ordered_quantity),
    bool_or(di.delivered_quantity - di.returned_quantity > 0)
  into v_all_delivered, v_any_delivered
  from public.dispatch_items as di
  where di.empresa_id = v_company_id and di.despacho_id = p_dispatch_id;

  select
    coalesce(bool_or(cp.tipo = 'producto'), false),
    coalesce(bool_and(
      case when cp.tipo = 'producto'
        then di.delivered_quantity - di.returned_quantity >= di.ordered_quantity
        else true end
    ), true)
  into v_any_product, v_all_product_delivered
  from public.dispatch_items as di
  left join public.catalogo_productos as cp
    on cp.id = di.product_id and cp.empresa_id = di.empresa_id
  where di.empresa_id = v_company_id and di.despacho_id = p_dispatch_id;

  v_dispatch_status := case when v_all_delivered then 'entregado' else 'parcial' end;
  v_delivery_status := case
    when v_all_delivered then 'entregado'
    when v_any_delivered then 'parcial'
    when p_event_type = 'return' then 'devuelto'
    else 'preparacion'
  end;

  update public.despachos as d
  set estado = v_dispatch_status,
      resultado = coalesce(nullif(btrim(coalesce(p_result, '')), ''), d.resultado),
      completado_at = case when v_all_delivered then coalesce(d.completado_at, now()) else null end,
      actualizado_por = v_user_id
  where d.id = p_dispatch_id and d.empresa_id = v_company_id;

  update public.ventas as v
  set estado = case
        when v_all_delivered and v.estado in ('confirmada', 'en_proceso') then 'completada'
        when not v_all_delivered and v.estado = 'confirmada' then 'en_proceso'
        else v.estado end,
      entrega_estado = v_delivery_status,
      inventario_estado = case
        when not v_any_product then 'no_aplica'
        when v_all_product_delivered then 'aplicado'
        when v_any_delivered or p_event_type = 'return' then 'parcial'
        else v.inventario_estado end,
      inventario_aplicado_at = case when v_any_product and v_all_product_delivered
        then coalesce(v.inventario_aplicado_at, now()) else v.inventario_aplicado_at end,
      inventario_aplicado_por = case when v_any_product and v_all_product_delivered
        then coalesce(v.inventario_aplicado_por, v_user_id) else v.inventario_aplicado_por end,
      actualizado_por = v_user_id
  where v.id = v_sale.id and v.empresa_id = v_company_id;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id, v_user_id, 'dispatch_fulfillments', v_fulfillment.id,
    'record_dispatch_' || p_event_type,
    jsonb_build_object(
      'dispatchId', p_dispatch_id,
      'operationId', p_operation_id,
      'dispatchStatus', v_dispatch_status,
      'salesReturnId', v_fulfillment.sales_return_id,
      'items', v_normalized_items
    )
  );

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id, 'dispatch.fulfillment.' || p_event_type, p_operation_id::text,
    v_request,
    jsonb_build_object(
      'fulfillmentId', v_fulfillment.id,
      'dispatchStatus', v_dispatch_status,
      'saleDeliveryStatus', v_delivery_status,
      'salesReturnId', v_fulfillment.sales_return_id
    ),
    v_user_id
  ) on conflict on constraint business_operation_receipts_key_unique do nothing;

  return query select v_fulfillment.id, v_dispatch_status, v_delivery_status,
    v_fulfillment.sales_return_id, false;
end;
$$;

create or replace function public.record_dispatch_full_delivery(
  p_operation_id uuid,
  p_dispatch_id uuid,
  p_receiver_name text default null,
  p_result text default null
)
returns table (
  fulfillment_id uuid,
  dispatch_status text,
  sale_delivery_status text,
  sales_return_id uuid,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
begin
  select df.request_payload->'items' into v_items
  from public.dispatch_fulfillments as df
  where df.empresa_id = public.current_empresa_id()
    and df.operation_id = p_operation_id;

  if v_items is null then
    select jsonb_agg(
      jsonb_build_object(
        'dispatchItemId', di.id,
        'quantity', di.ordered_quantity - (di.delivered_quantity - di.returned_quantity)
      ) order by di.created_at, di.id
    ) into v_items
    from public.dispatch_items as di
    where di.empresa_id = public.current_empresa_id()
      and di.despacho_id = p_dispatch_id
      and di.ordered_quantity > di.delivered_quantity - di.returned_quantity;
  end if;

  if coalesce(jsonb_array_length(v_items), 0) = 0 then
    raise exception 'El despacho no tiene cantidades pendientes de entrega.' using errcode = '22023';
  end if;

  return query
  select * from public.record_dispatch_fulfillment(
    p_operation_id, p_dispatch_id, 'delivery', v_items, null,
    p_receiver_name, p_result
  );
end;
$$;

revoke all on function public.initialize_dispatch_items()
  from public, anon, authenticated, service_role;
revoke all on function public.record_dispatch_fulfillment(
  uuid, uuid, text, jsonb, uuid, text, text
) from public, anon, service_role;
revoke all on function public.record_dispatch_full_delivery(uuid, uuid, text, text)
  from public, anon, service_role;
grant execute on function public.record_dispatch_fulfillment(
  uuid, uuid, text, jsonb, uuid, text, text
) to authenticated;
grant execute on function public.record_dispatch_full_delivery(uuid, uuid, text, text)
  to authenticated;

comment on table public.dispatch_items is
  'Per-line ordered, delivered and physically returned quantities for a dispatch.';
comment on table public.dispatch_fulfillments is
  'Idempotent partial delivery and operational return events.';
comment on function public.record_dispatch_fulfillment(uuid, uuid, text, jsonb, uuid, text, text)
  is 'Records partial delivery or physical return effects atomically and links returns to independent financial/fiscal processing.';
