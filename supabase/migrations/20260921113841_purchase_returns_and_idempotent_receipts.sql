-- Idempotent purchase receipts plus independent physical and financial supplier returns.

create table if not exists public.purchase_returns (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  order_id uuid not null,
  supplier_id uuid,
  number text not null,
  status text not null default 'confirmed',
  reason text not null,
  currency_code text not null default 'CRC',
  subtotal_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  inventory_status text not null default 'pending',
  inventory_operation_id uuid,
  inventory_processed_by uuid,
  inventory_processed_at timestamptz,
  financial_status text not null default 'pending',
  financial_operation_id uuid,
  financial_account_id uuid,
  financial_processed_by uuid,
  financial_processed_at timestamptz,
  supplier_credit_amount numeric(14, 2) not null default 0,
  supplier_document_reference text,
  create_operation_id uuid not null,
  create_request jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_returns_id_empresa_unique unique (id, empresa_id),
  constraint purchase_returns_empresa_number_unique unique (empresa_id, number),
  constraint purchase_returns_empresa_create_operation_unique unique (empresa_id, create_operation_id),
  constraint purchase_returns_order_empresa_fkey
    foreign key (order_id, empresa_id)
    references public.purchases_orders(id, empresa_id)
    on delete restrict,
  constraint purchase_returns_supplier_empresa_fkey
    foreign key (supplier_id, empresa_id)
    references public.purchases_suppliers(id, empresa_id)
    on delete set null (supplier_id),
  constraint purchase_returns_financial_account_empresa_fkey
    foreign key (financial_account_id, empresa_id)
    references public.payments_accounts(id, empresa_id)
    on delete set null (financial_account_id),
  constraint purchase_returns_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint purchase_returns_inventory_processed_by_empresa_fkey
    foreign key (inventory_processed_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (inventory_processed_by),
  constraint purchase_returns_financial_processed_by_empresa_fkey
    foreign key (financial_processed_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (financial_processed_by),
  constraint purchase_returns_status_check check (status in ('confirmed', 'cancelled')),
  constraint purchase_returns_inventory_status_check
    check (inventory_status in ('pending', 'processed', 'not_required')),
  constraint purchase_returns_financial_status_check
    check (financial_status in ('pending', 'processed', 'not_required')),
  constraint purchase_returns_amounts_check check (
    subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
    and supplier_credit_amount >= 0
  ),
  constraint purchase_returns_create_request_object_check
    check (jsonb_typeof(create_request) = 'object')
);

create unique index if not exists purchase_returns_empresa_inventory_operation_unique
  on public.purchase_returns (empresa_id, inventory_operation_id)
  where inventory_operation_id is not null;
create unique index if not exists purchase_returns_empresa_financial_operation_unique
  on public.purchase_returns (empresa_id, financial_operation_id)
  where financial_operation_id is not null;
create index if not exists purchase_returns_empresa_order_created_idx
  on public.purchase_returns (empresa_id, order_id, created_at desc);
create index if not exists purchase_returns_order_empresa_fkey_idx
  on public.purchase_returns (order_id, empresa_id);
create index if not exists purchase_returns_supplier_empresa_fkey_idx
  on public.purchase_returns (supplier_id, empresa_id);
create index if not exists purchase_returns_financial_account_empresa_fkey_idx
  on public.purchase_returns (financial_account_id, empresa_id);
create index if not exists purchase_returns_created_by_empresa_fkey_idx
  on public.purchase_returns (created_by, empresa_id);
create index if not exists purchase_returns_inventory_processed_by_empresa_fkey_idx
  on public.purchase_returns (inventory_processed_by, empresa_id);
create index if not exists purchase_returns_financial_processed_by_empresa_fkey_idx
  on public.purchase_returns (financial_processed_by, empresa_id);

drop trigger if exists set_purchase_returns_updated_at on public.purchase_returns;
create trigger set_purchase_returns_updated_at
before update on public.purchase_returns
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchases_receipt_items_id_empresa_unique'
      and conrelid = 'public.purchases_receipt_items'::regclass
  ) then
    alter table public.purchases_receipt_items
      add constraint purchases_receipt_items_id_empresa_unique unique (id, empresa_id);
  end if;
end;
$$;

create table if not exists public.purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  return_id uuid not null,
  receipt_item_id uuid not null,
  order_item_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,
  description text not null,
  quantity numeric(14, 2) not null,
  unit_cost numeric(14, 2) not null,
  tax_rate numeric(5, 2) not null default 0,
  subtotal_amount numeric(14, 2) not null,
  tax_amount numeric(14, 2) not null,
  total_amount numeric(14, 2) not null,
  created_at timestamptz not null default now(),

  constraint purchase_return_items_id_empresa_unique unique (id, empresa_id),
  constraint purchase_return_items_return_receipt_unique unique (return_id, receipt_item_id),
  constraint purchase_return_items_return_empresa_fkey
    foreign key (return_id, empresa_id)
    references public.purchase_returns(id, empresa_id)
    on delete cascade,
  constraint purchase_return_items_receipt_item_empresa_fkey
    foreign key (receipt_item_id, empresa_id)
    references public.purchases_receipt_items(id, empresa_id)
    on delete restrict,
  constraint purchase_return_items_order_item_empresa_fkey
    foreign key (order_item_id, empresa_id)
    references public.purchases_order_items(id, empresa_id)
    on delete restrict,
  constraint purchase_return_items_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint purchase_return_items_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint purchase_return_items_quantity_check check (quantity > 0),
  constraint purchase_return_items_amounts_check check (
    unit_cost >= 0 and tax_rate >= 0
    and subtotal_amount >= 0 and tax_amount >= 0 and total_amount >= 0
  )
);

create index if not exists purchase_return_items_empresa_return_idx
  on public.purchase_return_items (empresa_id, return_id, created_at);
create index if not exists purchase_return_items_receipt_item_empresa_fkey_idx
  on public.purchase_return_items (receipt_item_id, empresa_id);
create index if not exists purchase_return_items_order_item_empresa_fkey_idx
  on public.purchase_return_items (order_item_id, empresa_id);
create index if not exists purchase_return_items_product_empresa_fkey_idx
  on public.purchase_return_items (product_id, empresa_id);
create index if not exists purchase_return_items_warehouse_empresa_fkey_idx
  on public.purchase_return_items (warehouse_id, empresa_id);

create table if not exists public.purchase_supplier_credits (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  supplier_id uuid,
  order_id uuid not null,
  return_id uuid not null,
  amount numeric(14, 2) not null,
  currency_code text not null default 'CRC',
  status text not null default 'open',
  reference text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_supplier_credits_id_empresa_unique unique (id, empresa_id),
  constraint purchase_supplier_credits_return_unique unique (return_id),
  constraint purchase_supplier_credits_supplier_empresa_fkey
    foreign key (supplier_id, empresa_id)
    references public.purchases_suppliers(id, empresa_id)
    on delete set null (supplier_id),
  constraint purchase_supplier_credits_order_empresa_fkey
    foreign key (order_id, empresa_id)
    references public.purchases_orders(id, empresa_id)
    on delete restrict,
  constraint purchase_supplier_credits_return_empresa_fkey
    foreign key (return_id, empresa_id)
    references public.purchase_returns(id, empresa_id)
    on delete restrict,
  constraint purchase_supplier_credits_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint purchase_supplier_credits_amount_check check (amount > 0),
  constraint purchase_supplier_credits_status_check
    check (status in ('open', 'applied', 'settled', 'void'))
);

create index if not exists purchase_supplier_credits_empresa_supplier_status_idx
  on public.purchase_supplier_credits (empresa_id, supplier_id, status, created_at desc);
create index if not exists purchase_supplier_credits_supplier_empresa_fkey_idx
  on public.purchase_supplier_credits (supplier_id, empresa_id);
create index if not exists purchase_supplier_credits_order_empresa_fkey_idx
  on public.purchase_supplier_credits (order_id, empresa_id);
create index if not exists purchase_supplier_credits_return_empresa_fkey_idx
  on public.purchase_supplier_credits (return_id, empresa_id);
create index if not exists purchase_supplier_credits_created_by_empresa_fkey_idx
  on public.purchase_supplier_credits (created_by, empresa_id);

drop trigger if exists set_purchase_supplier_credits_updated_at on public.purchase_supplier_credits;
create trigger set_purchase_supplier_credits_updated_at
before update on public.purchase_supplier_credits
for each row execute function public.set_updated_at();

alter table public.purchase_returns enable row level security;
alter table public.purchase_return_items enable row level security;
alter table public.purchase_supplier_credits enable row level security;

revoke all on table public.purchase_returns from public, anon, authenticated;
revoke all on table public.purchase_return_items from public, anon, authenticated;
revoke all on table public.purchase_supplier_credits from public, anon, authenticated;
grant select on table public.purchase_returns to authenticated;
grant select on table public.purchase_return_items to authenticated;
grant select on table public.purchase_supplier_credits to authenticated;

drop policy if exists purchase_returns_select_permission on public.purchase_returns;
create policy purchase_returns_select_permission
on public.purchase_returns for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

drop policy if exists purchase_return_items_select_permission on public.purchase_return_items;
create policy purchase_return_items_select_permission
on public.purchase_return_items for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

drop policy if exists purchase_supplier_credits_select_permission on public.purchase_supplier_credits;
create policy purchase_supplier_credits_select_permission
on public.purchase_supplier_credits for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('payments.accounts.view'))
    or (select public.current_user_has_permission('payments.accounts.manage'))
  )
);

create or replace function public.receive_purchase_order_atomic(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns table (
  receipt_id uuid,
  order_id uuid,
  status text,
  received_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_request jsonb;
  v_receipt public.business_operation_receipts%rowtype;
  v_result record;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'orderId', p_order_id,
    'items', coalesce(p_items, 'null'::jsonb),
    'notes', nullif(btrim(coalesce(p_notes, '')), '')
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':purchases.receipt:' || p_operation_id::text,
      0
    )
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_empresa_id
    and r.scope = 'purchases.receipt'
    and r.idempotency_key = p_operation_id::text;

  if v_receipt.id is not null then
    if v_receipt.request_payload <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;

    return query select
      (v_receipt.result_payload->>'receiptId')::uuid,
      (v_receipt.result_payload->>'orderId')::uuid,
      v_receipt.result_payload->>'status',
      (v_receipt.result_payload->>'receivedAt')::timestamptz,
      true;
    return;
  end if;

  select * into v_result
  from public.recibir_orden_compra_parcial(p_order_id, p_items, p_notes);

  insert into public.business_operation_receipts (
    empresa_id,
    scope,
    idempotency_key,
    request_payload,
    result_payload,
    created_by
  )
  values (
    v_empresa_id,
    'purchases.receipt',
    p_operation_id::text,
    v_request,
    jsonb_build_object(
      'receiptId', v_result.receipt_id,
      'orderId', v_result.order_id,
      'status', v_result.estado,
      'receivedAt', v_result.received_at
    ),
    v_user_id
  );

  return query select
    v_result.receipt_id,
    v_result.order_id,
    v_result.estado,
    v_result.received_at,
    false;
end;
$$;

create or replace function public.create_purchase_return(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_reason text
)
returns table (
  return_id uuid,
  number text,
  total_amount numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
  v_return public.purchase_returns%rowtype;
  v_input jsonb;
  v_receipt_item public.purchases_receipt_items%rowtype;
  v_order_item public.purchases_order_items%rowtype;
  v_receipt public.purchases_receipts%rowtype;
  v_quantity numeric(14, 2);
  v_already_returned numeric(14, 2);
  v_previous_subtotal numeric(14, 2);
  v_previous_tax numeric(14, 2);
  v_receipt_tax numeric(14, 2);
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_return_subtotal numeric(14, 2) := 0;
  v_return_tax numeric(14, 2) := 0;
  v_return_total numeric(14, 2) := 0;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_request jsonb;
  v_number text;
  v_seq integer;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Indica un motivo entre 3 y 500 caracteres.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'La devolucion requiere entre 1 y 50 lineas.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item
    group by item->>'receiptItemId'
    having count(*) > 1
  ) then
    raise exception 'No repita lineas de recepcion en la devolucion.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'orderId', p_order_id,
    'items', p_items,
    'reason', v_reason
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':purchase.return.create:' || p_operation_id::text,
      0
    )
  );

  select pr.* into v_return
  from public.purchase_returns as pr
  where pr.empresa_id = v_empresa_id
    and pr.create_operation_id = p_operation_id;

  if v_return.id is not null then
    if v_return.create_request <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;

    return query select v_return.id, v_return.number, v_return.total_amount, true;
    return;
  end if;

  select po.* into v_order
  from public.purchases_orders as po
  where po.id = p_order_id
    and po.empresa_id = v_empresa_id
  for update;

  if v_order.id is null then
    raise exception 'Orden de compra no encontrada.' using errcode = '02000';
  end if;

  if v_order.estado not in ('parcial', 'recibida') then
    raise exception 'La orden no tiene mercancia recibida para devolver.' using errcode = '22023';
  end if;

  select count(*)::integer + 1 into v_seq
  from public.purchase_returns as pr
  where pr.empresa_id = v_empresa_id
    and pr.order_id = p_order_id;

  v_number := v_order.numero || '-DEV-' || lpad(v_seq::text, 3, '0');

  insert into public.purchase_returns (
    empresa_id,
    order_id,
    supplier_id,
    number,
    reason,
    currency_code,
    create_operation_id,
    create_request,
    created_by
  )
  values (
    v_empresa_id,
    v_order.id,
    v_order.supplier_id,
    v_number,
    v_reason,
    v_order.moneda,
    p_operation_id,
    v_request,
    v_user_id
  )
  returning * into v_return;

  for v_input in select * from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := nullif(v_input->>'quantity', '')::numeric;
    exception when others then
      raise exception 'Cantidad de devolucion invalida.' using errcode = '22023';
    end;

    if v_quantity is null
       or v_quantity <= 0
       or v_quantity <> round(v_quantity, 2) then
      raise exception 'Cantidad de devolucion invalida.' using errcode = '22023';
    end if;

    select pri.* into v_receipt_item
    from public.purchases_receipt_items as pri
    where pri.id = nullif(v_input->>'receiptItemId', '')::uuid
      and pri.empresa_id = v_empresa_id
    for update;

    if v_receipt_item.id is null then
      raise exception 'Linea de recepcion no encontrada.' using errcode = '02000';
    end if;

    select pr.* into v_receipt
    from public.purchases_receipts as pr
    where pr.id = v_receipt_item.receipt_id
      and pr.empresa_id = v_empresa_id
      and pr.order_id = p_order_id;

    if v_receipt.id is null then
      raise exception 'La linea no pertenece a esta orden.' using errcode = '22023';
    end if;

    select poi.* into v_order_item
    from public.purchases_order_items as poi
    where poi.id = v_receipt_item.order_item_id
      and poi.empresa_id = v_empresa_id
      and poi.order_id = p_order_id;

    if v_order_item.id is null or v_order_item.producto_id is null then
      raise exception 'La linea recibida no tiene un producto valido.' using errcode = '22023';
    end if;

    select
      coalesce(sum(pri.quantity), 0),
      coalesce(sum(pri.subtotal_amount), 0),
      coalesce(sum(pri.tax_amount), 0)
    into v_already_returned, v_previous_subtotal, v_previous_tax
    from public.purchase_return_items as pri
    join public.purchase_returns as pr
      on pr.id = pri.return_id
     and pr.empresa_id = pri.empresa_id
    where pri.empresa_id = v_empresa_id
      and pri.receipt_item_id = v_receipt_item.id
      and pr.status = 'confirmed';

    if v_already_returned + v_quantity > v_receipt_item.cantidad then
      raise exception 'La devolucion supera la cantidad recibida disponible.' using errcode = '22023';
    end if;

    v_receipt_tax := round(v_receipt_item.total * v_order_item.impuesto_porcentaje / 100, 2);

    if v_already_returned + v_quantity = v_receipt_item.cantidad then
      v_subtotal := greatest(v_receipt_item.total - v_previous_subtotal, 0);
      v_tax := greatest(v_receipt_tax - v_previous_tax, 0);
    else
      v_subtotal := round(v_quantity * v_receipt_item.costo_unitario, 2);
      v_tax := round(v_subtotal * v_order_item.impuesto_porcentaje / 100, 2);
    end if;
    v_total := v_subtotal + v_tax;

    insert into public.purchase_return_items (
      empresa_id,
      return_id,
      receipt_item_id,
      order_item_id,
      product_id,
      warehouse_id,
      description,
      quantity,
      unit_cost,
      tax_rate,
      subtotal_amount,
      tax_amount,
      total_amount
    )
    values (
      v_empresa_id,
      v_return.id,
      v_receipt_item.id,
      v_order_item.id,
      v_order_item.producto_id,
      v_receipt.bodega_id,
      v_order_item.descripcion,
      v_quantity,
      v_receipt_item.costo_unitario,
      v_order_item.impuesto_porcentaje,
      v_subtotal,
      v_tax,
      v_total
    );

    v_return_subtotal := v_return_subtotal + v_subtotal;
    v_return_tax := v_return_tax + v_tax;
    v_return_total := v_return_total + v_total;
  end loop;

  update public.purchase_returns as pr
  set
    subtotal_amount = v_return_subtotal,
    tax_amount = v_return_tax,
    total_amount = v_return_total,
    financial_status = case when v_return_total = 0 then 'not_required' else 'pending' end
  where pr.id = v_return.id
    and pr.empresa_id = v_empresa_id
  returning * into v_return;

  return query select v_return.id, v_return.number, v_return.total_amount, false;
end;
$$;

create or replace function public.apply_purchase_return_inventory(
  p_operation_id uuid,
  p_return_id uuid
)
returns table (
  return_id uuid,
  inventory_status text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.purchase_returns%rowtype;
  v_item public.purchase_return_items%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_new_quantity numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage')
     or not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permisos de compras e inventario requeridos.' using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':purchase.return.inventory:' || p_operation_id::text,
      0
    )
  );

  select pr.* into v_return
  from public.purchase_returns as pr
  where pr.id = p_return_id
    and pr.empresa_id = v_empresa_id
  for update;

  if v_return.id is null then
    raise exception 'Devolucion de compra no encontrada.' using errcode = '02000';
  end if;

  if v_return.inventory_status = 'processed' then
    if v_return.inventory_operation_id <> p_operation_id then
      raise exception 'El inventario de la devolucion ya fue procesado con otra operacion.'
        using errcode = '23505';
    end if;
    return query select v_return.id, v_return.inventory_status, true;
    return;
  end if;

  if v_return.inventory_status <> 'pending' or v_return.status <> 'confirmed' then
    raise exception 'La devolucion no admite salida de inventario.' using errcode = '22023';
  end if;

  for v_item in
    select pri.*
    from public.purchase_return_items as pri
    where pri.empresa_id = v_empresa_id
      and pri.return_id = v_return.id
    order by pri.product_id, pri.warehouse_id, pri.id
  loop
    select ist.* into v_stock
    from public.inventario_stock as ist
    where ist.empresa_id = v_empresa_id
      and ist.producto_id = v_item.product_id
      and ist.bodega_id = v_item.warehouse_id
    for update;

    if v_stock.id is null or v_stock.cantidad < v_item.quantity then
      raise exception 'Existencia insuficiente para devolver %.', v_item.description
        using errcode = '22023';
    end if;

    v_new_quantity := v_stock.cantidad - v_item.quantity;

    update public.inventario_stock as ist
    set cantidad = v_new_quantity
    where ist.id = v_stock.id
      and ist.empresa_id = v_empresa_id;

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
      v_item.product_id,
      v_item.warehouse_id,
      'salida',
      v_item.quantity,
      v_stock.cantidad,
      v_new_quantity,
      'Devolucion a proveedor ' || v_return.number,
      'purchase_return',
      v_return.id,
      v_user_id
    );
  end loop;

  update public.purchase_returns as pr
  set
    inventory_status = 'processed',
    inventory_operation_id = p_operation_id,
    inventory_processed_by = v_user_id,
    inventory_processed_at = now()
  where pr.id = v_return.id
    and pr.empresa_id = v_empresa_id
  returning * into v_return;

  return query select v_return.id, v_return.inventory_status, false;
end;
$$;

create or replace function public.settle_purchase_return_financial(
  p_operation_id uuid,
  p_return_id uuid,
  p_supplier_document_reference text default null
)
returns table (
  return_id uuid,
  account_id uuid,
  account_total numeric,
  account_balance numeric,
  supplier_credit numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.purchase_returns%rowtype;
  v_account public.payments_accounts%rowtype;
  v_paid numeric(14, 2);
  v_new_total numeric(14, 2);
  v_new_balance numeric(14, 2);
  v_supplier_credit numeric(14, 2);
  v_reference text := nullif(btrim(coalesce(p_supplier_document_reference, '')), '');
  v_new_status text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage')
     or not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permisos de compras y pagos requeridos.' using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  if length(coalesce(v_reference, '')) > 160 then
    raise exception 'La referencia no puede superar 160 caracteres.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':purchase.return.financial:' || p_operation_id::text,
      0
    )
  );

  select pr.* into v_return
  from public.purchase_returns as pr
  where pr.id = p_return_id
    and pr.empresa_id = v_empresa_id
  for update;

  if v_return.id is null then
    raise exception 'Devolucion de compra no encontrada.' using errcode = '02000';
  end if;

  if v_return.financial_status = 'processed' then
    if v_return.financial_operation_id <> p_operation_id
       or coalesce(v_return.supplier_document_reference, '') <> coalesce(v_reference, '') then
      raise exception 'La devolucion financiera ya fue procesada con otra operacion.'
        using errcode = '23505';
    end if;

    select pa.* into v_account
    from public.payments_accounts as pa
    where pa.id = v_return.financial_account_id
      and pa.empresa_id = v_empresa_id;

    return query select
      v_return.id,
      v_return.financial_account_id,
      v_account.total,
      v_account.saldo,
      v_return.supplier_credit_amount,
      true;
    return;
  end if;

  if v_return.financial_status <> 'pending'
     or v_return.status <> 'confirmed'
     or v_return.total_amount <= 0 then
    raise exception 'La devolucion no admite ajuste financiero.' using errcode = '22023';
  end if;

  select pa.* into v_account
  from public.payments_accounts as pa
  where pa.empresa_id = v_empresa_id
    and pa.compra_id = v_return.order_id
    and pa.tipo = 'payable'
  for update;

  if v_account.id is null then
    raise exception 'La compra no tiene una cuenta por pagar sincronizada.' using errcode = '02000';
  end if;

  select coalesce(sum(pt.monto), 0) into v_paid
  from public.payments_transactions as pt
  where pt.empresa_id = v_empresa_id
    and pt.account_id = v_account.id;

  v_new_total := greatest(v_account.total - v_return.total_amount, 0);
  v_new_balance := greatest(v_new_total - v_paid, 0);
  v_supplier_credit := greatest(v_paid - v_new_total, 0);
  v_new_status := case
    when v_new_balance = 0 then 'pagada'
    when v_paid > 0 then 'parcial'
    when v_account.fecha_vencimiento is not null
      and v_account.fecha_vencimiento < current_date then 'vencida'
    else 'pendiente'
  end;

  update public.payments_accounts as pa
  set
    total = v_new_total,
    saldo = v_new_balance,
    estado = v_new_status,
    updated_by = v_user_id
  where pa.id = v_account.id
    and pa.empresa_id = v_empresa_id
  returning * into v_account;

  if v_supplier_credit > 0 then
    insert into public.purchase_supplier_credits (
      empresa_id,
      supplier_id,
      order_id,
      return_id,
      amount,
      currency_code,
      reference,
      created_by
    )
    values (
      v_empresa_id,
      v_return.supplier_id,
      v_return.order_id,
      v_return.id,
      v_supplier_credit,
      v_return.currency_code,
      v_reference,
      v_user_id
    )
    on conflict (return_id) do nothing;
  end if;

  update public.purchase_returns as pr
  set
    financial_status = 'processed',
    financial_operation_id = p_operation_id,
    financial_account_id = v_account.id,
    financial_processed_by = v_user_id,
    financial_processed_at = now(),
    supplier_credit_amount = v_supplier_credit,
    supplier_document_reference = v_reference
  where pr.id = v_return.id
    and pr.empresa_id = v_empresa_id
  returning * into v_return;

  return query select
    v_return.id,
    v_account.id,
    v_account.total,
    v_account.saldo,
    v_supplier_credit,
    false;
end;
$$;

create or replace function public.sync_payable_account_for_purchase(
  p_empresa_id uuid,
  p_order_id uuid,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.purchases_orders%rowtype;
  v_received_total numeric(14, 2);
  v_returned_total numeric(14, 2);
  v_target_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_account public.payments_accounts%rowtype;
begin
  select po.* into v_order
  from public.purchases_orders as po
  where po.id = p_order_id
    and po.empresa_id = p_empresa_id;

  if v_order.id is null then
    raise exception 'Orden de compra no encontrada.' using errcode = '02000';
  end if;

  if v_order.estado not in ('parcial', 'recibida') then
    return null;
  end if;

  select coalesce(sum(
    round(poi.cantidad_recibida * poi.costo_unitario, 2)
    + round(round(poi.cantidad_recibida * poi.costo_unitario, 2) * poi.impuesto_porcentaje / 100, 2)
  ), 0)
  into v_received_total
  from public.purchases_order_items as poi
  where poi.empresa_id = p_empresa_id
    and poi.order_id = p_order_id;

  select coalesce(sum(pr.total_amount), 0)
  into v_returned_total
  from public.purchase_returns as pr
  where pr.empresa_id = p_empresa_id
    and pr.order_id = p_order_id
    and pr.status = 'confirmed'
    and pr.financial_status = 'processed';

  v_target_total := greatest(v_received_total - v_returned_total, 0);

  select pa.* into v_account
  from public.payments_accounts as pa
  where pa.empresa_id = p_empresa_id
    and pa.compra_id = p_order_id
    and pa.tipo = 'payable'
  for update;

  select coalesce(sum(pt.monto), 0)
  into v_paid
  from public.payments_transactions as pt
  where pt.empresa_id = p_empresa_id
    and pt.account_id = v_account.id;

  insert into public.payments_accounts (
    empresa_id,
    tipo,
    compra_id,
    proveedor_id,
    numero,
    descripcion,
    moneda,
    total,
    saldo,
    fecha_emision,
    fecha_vencimiento,
    estado,
    created_by,
    updated_by
  )
  values (
    p_empresa_id,
    'payable',
    v_order.id,
    v_order.supplier_id,
    'CXP-' || v_order.numero,
    'Cuenta por pagar de compra ' || v_order.numero,
    v_order.moneda,
    v_target_total,
    greatest(v_target_total - coalesce(v_paid, 0), 0),
    current_date,
    current_date + interval '30 days',
    case
      when greatest(v_target_total - coalesce(v_paid, 0), 0) = 0 then 'pagada'
      when coalesce(v_paid, 0) > 0 then 'parcial'
      else 'pendiente'
    end,
    p_user_id,
    p_user_id
  )
  on conflict (empresa_id, compra_id)
  where compra_id is not null and tipo = 'payable'
  do update set
    proveedor_id = excluded.proveedor_id,
    total = excluded.total,
    saldo = greatest(excluded.total - coalesce(v_paid, 0), 0),
    estado = case
      when greatest(excluded.total - coalesce(v_paid, 0), 0) = 0 then 'pagada'
      when coalesce(v_paid, 0) > 0 then 'parcial'
      when public.payments_accounts.fecha_vencimiento is not null
        and public.payments_accounts.fecha_vencimiento < current_date then 'vencida'
      else 'pendiente'
    end,
    updated_by = p_user_id
  returning * into v_account;

  return v_account.id;
end;
$$;

revoke all on function public.recibir_orden_compra_parcial(uuid, jsonb, text)
  from public, anon, authenticated;

revoke all on function public.receive_purchase_order_atomic(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.create_purchase_return(uuid, uuid, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_purchase_return_inventory(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.settle_purchase_return_financial(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.sync_payable_account_for_purchase(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.receive_purchase_order_atomic(uuid, uuid, jsonb, text)
  to authenticated;
grant execute on function public.create_purchase_return(uuid, uuid, jsonb, text)
  to authenticated;
grant execute on function public.apply_purchase_return_inventory(uuid, uuid)
  to authenticated;
grant execute on function public.settle_purchase_return_financial(uuid, uuid, text)
  to authenticated;
grant execute on function public.sync_payable_account_for_purchase(uuid, uuid, uuid)
  to service_role;

comment on function public.receive_purchase_order_atomic(uuid, uuid, jsonb, text)
  is 'Receives purchase-order quantities exactly once per tenant operation id.';
comment on function public.create_purchase_return(uuid, uuid, jsonb, text)
  is 'Captures a partial supplier return from immutable receipt-line snapshots.';
comment on function public.apply_purchase_return_inventory(uuid, uuid)
  is 'Removes returned supplier goods atomically without duplicating stock movements.';
comment on function public.settle_purchase_return_financial(uuid, uuid, text)
  is 'Reduces the payable once and records any supplier credit caused by prior payment.';
