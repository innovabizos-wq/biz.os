-- Complete internal purchases and payments flow.
-- Additive migration: preserves existing suppliers, orders, items, payments and RPC names.

alter table public.purchases_order_items
  add column if not exists cantidad_recibida numeric(14, 2) not null default 0;

alter table public.purchases_order_items
  drop constraint if exists purchases_order_items_cantidad_recibida_check;
alter table public.purchases_order_items
  add constraint purchases_order_items_cantidad_recibida_check
  check (cantidad_recibida >= 0 and cantidad_recibida <= cantidad);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'purchases_order_items_id_empresa_unique'
      and conrelid = 'public.purchases_order_items'::regclass
  ) then
    alter table public.purchases_order_items
      add constraint purchases_order_items_id_empresa_unique unique (id, empresa_id);
  end if;
end;
$$;

alter table public.purchases_orders
  drop constraint if exists purchases_orders_estado_check;
alter table public.purchases_orders
  add constraint purchases_orders_estado_check
  check (estado in ('borrador', 'emitida', 'parcial', 'recibida', 'cancelada'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_accounts_compra_empresa_fkey'
      and conrelid = 'public.payments_accounts'::regclass
  ) then
    alter table public.payments_accounts
      add constraint payments_accounts_compra_empresa_fkey
      foreign key (compra_id, empresa_id)
      references public.purchases_orders(id, empresa_id)
      on delete set null (compra_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_accounts_proveedor_empresa_fkey'
      and conrelid = 'public.payments_accounts'::regclass
  ) then
    alter table public.payments_accounts
      add constraint payments_accounts_proveedor_empresa_fkey
      foreign key (proveedor_id, empresa_id)
      references public.purchases_suppliers(id, empresa_id)
      on delete set null (proveedor_id);
  end if;
end;
$$;

create unique index if not exists payments_accounts_empresa_compra_unique
  on public.payments_accounts (empresa_id, compra_id)
  where compra_id is not null and tipo = 'payable';
create index if not exists payments_accounts_empresa_proveedor_idx
  on public.payments_accounts (empresa_id, proveedor_id);
create index if not exists payments_accounts_compra_empresa_fkey_idx
  on public.payments_accounts (compra_id, empresa_id);
create index if not exists payments_accounts_proveedor_empresa_fkey_idx
  on public.payments_accounts (proveedor_id, empresa_id);

create table if not exists public.purchases_receipts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  order_id uuid not null,
  numero text not null,
  bodega_id uuid not null,
  received_by uuid,
  received_at timestamptz not null default now(),
  notas text,
  created_at timestamptz not null default now(),

  constraint purchases_receipts_empresa_numero_unique unique (empresa_id, numero),
  constraint purchases_receipts_id_empresa_unique unique (id, empresa_id),
  constraint purchases_receipts_order_empresa_fkey
    foreign key (order_id, empresa_id)
    references public.purchases_orders(id, empresa_id)
    on delete cascade,
  constraint purchases_receipts_bodega_empresa_fkey
    foreign key (bodega_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id),
  constraint purchases_receipts_received_by_empresa_fkey
    foreign key (received_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (received_by)
);

create index if not exists purchases_receipts_empresa_order_idx
  on public.purchases_receipts (empresa_id, order_id, received_at desc);
create index if not exists purchases_receipts_bodega_empresa_fkey_idx
  on public.purchases_receipts (bodega_id, empresa_id);
create index if not exists purchases_receipts_received_by_empresa_fkey_idx
  on public.purchases_receipts (received_by, empresa_id);

create table if not exists public.purchases_receipt_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  receipt_id uuid not null,
  order_item_id uuid not null,
  producto_id uuid not null,
  cantidad numeric(14, 2) not null,
  costo_unitario numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),

  constraint purchases_receipt_items_cantidad_check check (cantidad > 0),
  constraint purchases_receipt_items_receipt_empresa_fkey
    foreign key (receipt_id, empresa_id)
    references public.purchases_receipts(id, empresa_id)
    on delete cascade,
  constraint purchases_receipt_items_order_item_empresa_fkey
    foreign key (order_item_id, empresa_id)
    references public.purchases_order_items(id, empresa_id)
    on delete restrict,
  constraint purchases_receipt_items_producto_empresa_fkey
    foreign key (producto_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
);

create index if not exists purchases_receipt_items_empresa_receipt_idx
  on public.purchases_receipt_items (empresa_id, receipt_id);
create index if not exists purchases_receipt_items_order_item_empresa_fkey_idx
  on public.purchases_receipt_items (order_item_id, empresa_id);
create index if not exists purchases_receipt_items_producto_empresa_fkey_idx
  on public.purchases_receipt_items (producto_id, empresa_id);

alter table public.purchases_receipts enable row level security;
alter table public.purchases_receipt_items enable row level security;

grant select on public.purchases_receipts to authenticated;
grant select on public.purchases_receipt_items to authenticated;

drop policy if exists purchases_receipts_select_permission on public.purchases_receipts;
create policy purchases_receipts_select_permission
on public.purchases_receipts
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

drop policy if exists purchases_receipt_items_select_permission on public.purchases_receipt_items;
create policy purchases_receipt_items_select_permission
on public.purchases_receipt_items
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

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
  v_paid numeric(14, 2);
  v_account public.payments_accounts%rowtype;
begin
  select * into v_order
  from public.purchases_orders
  where id = p_order_id
    and empresa_id = p_empresa_id;

  if v_order.id is null then
    raise exception 'Orden de compra no encontrada.' using errcode = '02000';
  end if;

  if v_order.estado not in ('parcial', 'recibida') then
    return null;
  end if;

  select coalesce(sum(t.monto), 0)
  into v_paid
  from public.payments_accounts as a
  left join public.payments_transactions as t
    on t.empresa_id = a.empresa_id
   and t.account_id = a.id
  where a.empresa_id = p_empresa_id
    and a.compra_id = p_order_id
    and a.tipo = 'payable';

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
    v_order.total,
    greatest(v_order.total - coalesce(v_paid, 0), 0),
    current_date,
    current_date + interval '30 days',
    case
      when greatest(v_order.total - coalesce(v_paid, 0), 0) = 0 then 'pagada'
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

create or replace function public.crear_orden_compra_completa(
  p_supplier_id uuid,
  p_bodega_id uuid,
  p_items jsonb,
  p_estado text default 'borrador',
  p_notas text default null
)
returns table (order_id uuid, numero text, estado text, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
  v_numero text;
  v_seq integer;
  v_item jsonb;
  v_product public.catalogo_productos%rowtype;
  v_description text;
  v_quantity numeric(14, 2);
  v_cost numeric(14, 2);
  v_tax_rate numeric(5, 2);
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_order_subtotal numeric(14, 2) := 0;
  v_order_tax numeric(14, 2) := 0;
  v_order_total numeric(14, 2) := 0;
  v_order_state text := coalesce(nullif(btrim(p_estado), ''), 'borrador');
  v_index integer := 0;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  if v_order_state not in ('borrador', 'emitida') then
    raise exception 'Estado de orden invalido.' using errcode = '22023';
  end if;

  if p_supplier_id is null or p_bodega_id is null then
    raise exception 'Proveedor y bodega son requeridos.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden requiere al menos un item.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.purchases_suppliers
    where id = p_supplier_id and empresa_id = v_empresa_id and estado = 'activo'
  ) then
    raise exception 'Proveedor no disponible.' using errcode = '02000';
  end if;

  if not exists (
    select 1 from public.inventario_bodegas
    where id = p_bodega_id and empresa_id = v_empresa_id and estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.purchases_orders
  where empresa_id = v_empresa_id
    and date_part('year', created_at) = date_part('year', now());

  v_numero := 'OC-' || to_char(current_date, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');

  insert into public.purchases_orders (
    empresa_id,
    supplier_id,
    numero,
    estado,
    moneda,
    subtotal,
    impuesto_total,
    total,
    bodega_id,
    notas,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_supplier_id,
    v_numero,
    v_order_state,
    'CRC',
    0,
    0,
    0,
    p_bodega_id,
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    select * into v_product
    from public.catalogo_productos
    where id = nullif(v_item->>'productoId', '')::uuid
      and empresa_id = v_empresa_id
      and tipo = 'producto'
      and estado = 'activo';

    if v_product.id is null then
      raise exception 'Producto no disponible en item %.', v_index using errcode = '02000';
    end if;

    v_quantity := coalesce(nullif(v_item->>'cantidad', '')::numeric, 0);
    v_cost := coalesce(nullif(v_item->>'costoUnitario', '')::numeric, 0);
    v_tax_rate := coalesce(nullif(v_item->>'impuestoPorcentaje', '')::numeric, 0);
    v_description := coalesce(nullif(btrim(v_item->>'descripcion'), ''), v_product.nombre);

    if v_quantity <= 0 or v_cost < 0 or v_tax_rate < 0 then
      raise exception 'Cantidad, costo o impuesto invalido en item %.', v_index using errcode = '22023';
    end if;

    v_subtotal := round(v_quantity * v_cost, 2);
    v_tax := round(v_subtotal * v_tax_rate / 100, 2);
    v_total := v_subtotal + v_tax;
    v_order_subtotal := v_order_subtotal + v_subtotal;
    v_order_tax := v_order_tax + v_tax;
    v_order_total := v_order_total + v_total;

    insert into public.purchases_order_items (
      empresa_id,
      order_id,
      producto_id,
      descripcion,
      cantidad,
      costo_unitario,
      impuesto_porcentaje,
      subtotal,
      impuesto_monto,
      total,
      orden
    )
    values (
      v_empresa_id,
      v_order.id,
      v_product.id,
      v_description,
      v_quantity,
      v_cost,
      v_tax_rate,
      v_subtotal,
      v_tax,
      v_total,
      v_index
    );
  end loop;

  update public.purchases_orders
  set
    subtotal = v_order_subtotal,
    impuesto_total = v_order_tax,
    total = v_order_total,
    updated_by = v_user_id
  where id = v_order.id
    and empresa_id = v_empresa_id
  returning * into v_order;

  return query select v_order.id, v_order.numero, v_order.estado, v_order.total;
end;
$$;

create or replace function public.cambiar_estado_proveedor_compra(
  p_supplier_id uuid,
  p_estado text
)
returns table (supplier_id uuid, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_supplier public.purchases_suppliers%rowtype;
  v_estado text := coalesce(nullif(btrim(p_estado), ''), 'activo');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.suppliers.manage') then
    raise exception 'Permiso purchases.suppliers.manage requerido.' using errcode = '42501';
  end if;

  if v_estado not in ('activo', 'inactivo') then
    raise exception 'Estado de proveedor invalido.' using errcode = '22023';
  end if;

  update public.purchases_suppliers
  set estado = v_estado, updated_by = v_user_id
  where id = p_supplier_id
    and empresa_id = v_empresa_id
  returning * into v_supplier;

  if v_supplier.id is null then
    raise exception 'Proveedor no encontrado.' using errcode = '02000';
  end if;

  return query select v_supplier.id, v_supplier.estado;
end;
$$;

create or replace function public.emitir_orden_compra(
  p_order_id uuid
)
returns table (order_id uuid, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  update public.purchases_orders
  set estado = 'emitida', updated_by = v_user_id
  where id = p_order_id
    and empresa_id = v_empresa_id
    and estado = 'borrador'
  returning * into v_order;

  if v_order.id is null then
    raise exception 'Solo se pueden emitir ordenes en borrador.' using errcode = '22023';
  end if;

  return query select v_order.id, v_order.estado;
end;
$$;

create or replace function public.cancelar_orden_compra(
  p_order_id uuid
)
returns table (order_id uuid, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  update public.purchases_orders
  set estado = 'cancelada', updated_by = v_user_id
  where id = p_order_id
    and empresa_id = v_empresa_id
    and estado in ('borrador', 'emitida')
  returning * into v_order;

  if v_order.id is null then
    raise exception 'La orden ya tiene recepciones o no puede cancelarse.' using errcode = '22023';
  end if;

  return query select v_order.id, v_order.estado;
end;
$$;

create or replace function public.recibir_orden_compra_parcial(
  p_order_id uuid,
  p_items jsonb,
  p_notas text default null
)
returns table (receipt_id uuid, order_id uuid, estado text, received_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
  v_receipt public.purchases_receipts%rowtype;
  v_item_input jsonb;
  v_item public.purchases_order_items%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_qty numeric(14, 2);
  v_anterior numeric(14, 2);
  v_nueva numeric(14, 2);
  v_received_total numeric(14, 2);
  v_order_total_qty numeric(14, 2);
  v_receipt_numero text;
  v_seq integer;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La recepcion requiere al menos un item.' using errcode = '22023';
  end if;

  select * into v_order
  from public.purchases_orders
  where id = p_order_id
    and empresa_id = v_empresa_id
  for update;

  if v_order.id is null then
    raise exception 'Orden de compra no encontrada.' using errcode = '02000';
  end if;

  if v_order.estado not in ('emitida', 'parcial') then
    raise exception 'Solo se pueden recibir ordenes emitidas o parciales.' using errcode = '22023';
  end if;

  if v_order.bodega_id is null then
    raise exception 'La orden no tiene bodega de recepcion.' using errcode = '22023';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.purchases_receipts
  where empresa_id = v_empresa_id
    and order_id = p_order_id;

  v_receipt_numero := v_order.numero || '-REC-' || lpad(v_seq::text, 3, '0');

  insert into public.purchases_receipts (
    empresa_id,
    order_id,
    numero,
    bodega_id,
    received_by,
    notas
  )
  values (
    v_empresa_id,
    p_order_id,
    v_receipt_numero,
    v_order.bodega_id,
    v_user_id,
    nullif(btrim(coalesce(p_notas, '')), '')
  )
  returning * into v_receipt;

  for v_item_input in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce(nullif(v_item_input->>'cantidad', '')::numeric, 0);

    if v_qty <= 0 then
      continue;
    end if;

    select * into v_item
    from public.purchases_order_items
    where id = nullif(v_item_input->>'itemId', '')::uuid
      and empresa_id = v_empresa_id
      and order_id = p_order_id
    for update;

    if v_item.id is null then
      raise exception 'Item de orden no encontrado.' using errcode = '02000';
    end if;

    if v_item.producto_id is null then
      raise exception 'El item no tiene producto asociado.' using errcode = '22023';
    end if;

    if v_item.cantidad_recibida + v_qty > v_item.cantidad then
      raise exception 'La recepcion supera la cantidad pendiente.' using errcode = '22023';
    end if;

    insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
    values (v_empresa_id, v_item.producto_id, v_order.bodega_id, 0)
    on conflict on constraint inventario_stock_empresa_producto_bodega_unique
    do nothing;

    select * into v_stock
    from public.inventario_stock
    where empresa_id = v_empresa_id
      and producto_id = v_item.producto_id
      and bodega_id = v_order.bodega_id
    for update;

    v_anterior := v_stock.cantidad;
    v_nueva := v_stock.cantidad + v_qty;

    update public.inventario_stock
    set cantidad = v_nueva
    where id = v_stock.id
      and empresa_id = v_empresa_id;

    update public.purchases_order_items
    set cantidad_recibida = cantidad_recibida + v_qty
    where id = v_item.id
      and empresa_id = v_empresa_id;

    insert into public.purchases_receipt_items (
      empresa_id,
      receipt_id,
      order_item_id,
      producto_id,
      cantidad,
      costo_unitario,
      total
    )
    values (
      v_empresa_id,
      v_receipt.id,
      v_item.id,
      v_item.producto_id,
      v_qty,
      v_item.costo_unitario,
      round(v_qty * v_item.costo_unitario, 2)
    );

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
      v_order.bodega_id,
      'entrada',
      v_qty,
      v_anterior,
      v_nueva,
      'Recepcion de orden de compra ' || v_order.numero,
      'purchase_receipt',
      v_receipt.id,
      v_user_id
    );
  end loop;

  if not exists (
    select 1
    from public.purchases_receipt_items
    where empresa_id = v_empresa_id
      and receipt_id = v_receipt.id
  ) then
    raise exception 'No se recibio ninguna cantidad valida.' using errcode = '22023';
  end if;

  select coalesce(sum(cantidad_recibida), 0), coalesce(sum(cantidad), 0)
  into v_received_total, v_order_total_qty
  from public.purchases_order_items
  where empresa_id = v_empresa_id
    and order_id = p_order_id;

  update public.purchases_orders
  set
    estado = case
      when v_received_total >= v_order_total_qty then 'recibida'
      else 'parcial'
    end,
    fecha_recepcion = case
      when v_received_total >= v_order_total_qty then current_date
      else fecha_recepcion
    end,
    received_at = case
      when v_received_total >= v_order_total_qty then now()
      else received_at
    end,
    updated_by = v_user_id
  where id = p_order_id
    and empresa_id = v_empresa_id
  returning * into v_order;

  perform public.sync_payable_account_for_purchase(v_empresa_id, p_order_id, v_user_id);

  return query select v_receipt.id, v_order.id, v_order.estado, v_receipt.received_at;
end;
$$;

create or replace function public.sincronizar_cuentas_pagar_compras_actual()
returns table (
  account_id uuid,
  compra_id uuid,
  numero text,
  total numeric,
  saldo numeric,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order record;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('payments.accounts.view')
    or public.current_user_has_permission('payments.accounts.manage')
  ) then
    raise exception 'Permiso payments.accounts.view requerido.' using errcode = '42501';
  end if;

  for v_order in
    select id
    from public.purchases_orders
    where empresa_id = v_empresa_id
      and estado in ('parcial', 'recibida')
  loop
    perform public.sync_payable_account_for_purchase(v_empresa_id, v_order.id, v_user_id);
  end loop;

  return query
  select
    a.id,
    a.compra_id,
    a.numero,
    a.total,
    a.saldo,
    a.estado
  from public.payments_accounts as a
  where a.empresa_id = v_empresa_id
    and a.tipo = 'payable'
  order by a.created_at desc;
end;
$$;

create or replace function public.registrar_movimiento_cuenta(
  p_account_id uuid,
  p_monto numeric,
  p_metodo text default 'manual',
  p_referencia text default null,
  p_notas text default null
)
returns table (
  account_id uuid,
  saldo numeric,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_account public.payments_accounts%rowtype;
  v_amount numeric(14, 2);
  v_new_saldo numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permiso payments.accounts.manage requerido.' using errcode = '42501';
  end if;

  if coalesce(p_monto, 0) <= 0 then
    raise exception 'Monto requerido.' using errcode = '22023';
  end if;

  select * into v_account
  from public.payments_accounts
  where id = p_account_id
    and empresa_id = v_empresa_id
  for update;

  if v_account.id is null then
    raise exception 'Cuenta no encontrada.' using errcode = '02000';
  end if;

  if v_account.estado in ('pagada', 'anulada') then
    raise exception 'La cuenta no acepta nuevos movimientos.' using errcode = '22023';
  end if;

  v_amount := least(p_monto, v_account.saldo);

  insert into public.payments_transactions (
    empresa_id,
    account_id,
    tipo,
    monto,
    metodo,
    referencia,
    notas,
    created_by
  )
  values (
    v_empresa_id,
    p_account_id,
    'payment',
    v_amount,
    coalesce(nullif(btrim(p_metodo), ''), 'manual'),
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id
  );

  v_new_saldo := greatest(v_account.saldo - v_amount, 0);

  update public.payments_accounts
  set
    saldo = v_new_saldo,
    estado = case when v_new_saldo = 0 then 'pagada' else 'parcial' end,
    updated_by = v_user_id
  where id = p_account_id
    and empresa_id = v_empresa_id;

  return query
  select p_account_id, v_new_saldo, case when v_new_saldo = 0 then 'pagada' else 'parcial' end;
end;
$$;

create or replace function public.anular_cuenta_pago(
  p_account_id uuid,
  p_notas text default null
)
returns table (account_id uuid, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_account public.payments_accounts%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permiso payments.accounts.manage requerido.' using errcode = '42501';
  end if;

  update public.payments_accounts
  set
    estado = 'anulada',
    descripcion = coalesce(descripcion, '') ||
      case when nullif(btrim(coalesce(p_notas, '')), '') is null then '' else ' | Anulada: ' || nullif(btrim(coalesce(p_notas, '')), '') end,
    updated_by = v_user_id
  where id = p_account_id
    and empresa_id = v_empresa_id
    and estado <> 'anulada'
  returning * into v_account;

  if v_account.id is null then
    raise exception 'Cuenta no encontrada o ya anulada.' using errcode = '02000';
  end if;

  return query select v_account.id, v_account.estado;
end;
$$;

create or replace function public.recibir_orden_compra(
  p_order_id uuid
)
returns table (order_id uuid, estado text, received_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_result record;
begin
  select jsonb_agg(
    jsonb_build_object(
      'itemId', id,
      'cantidad', cantidad - cantidad_recibida
    )
  )
  into v_items
  from public.purchases_order_items
  where order_id = p_order_id
    and empresa_id = public.current_empresa_id()
    and cantidad > cantidad_recibida;

  for v_result in
    select *
    from public.recibir_orden_compra_parcial(p_order_id, coalesce(v_items, '[]'::jsonb), null)
  loop
    return query select v_result.order_id, v_result.estado, v_result.received_at;
  end loop;
end;
$$;

create or replace function public.registrar_pago_cuenta_cobrar(
  p_account_id uuid,
  p_monto numeric,
  p_metodo text default 'manual',
  p_referencia text default null,
  p_notas text default null
)
returns table (
  account_id uuid,
  saldo numeric,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select *
  from public.registrar_movimiento_cuenta(
    p_account_id,
    p_monto,
    p_metodo,
    p_referencia,
    p_notas
  );
end;
$$;

revoke all on function public.sync_payable_account_for_purchase(uuid, uuid, uuid) from public;
revoke all on function public.crear_orden_compra_completa(uuid, uuid, jsonb, text, text) from public;
revoke all on function public.cambiar_estado_proveedor_compra(uuid, text) from public;
revoke all on function public.emitir_orden_compra(uuid) from public;
revoke all on function public.cancelar_orden_compra(uuid) from public;
revoke all on function public.recibir_orden_compra_parcial(uuid, jsonb, text) from public;
revoke all on function public.sincronizar_cuentas_pagar_compras_actual() from public;
revoke all on function public.registrar_movimiento_cuenta(uuid, numeric, text, text, text) from public;
revoke all on function public.anular_cuenta_pago(uuid, text) from public;
revoke all on function public.recibir_orden_compra(uuid) from public;
revoke all on function public.registrar_pago_cuenta_cobrar(uuid, numeric, text, text, text) from public;

grant execute on function public.crear_orden_compra_completa(uuid, uuid, jsonb, text, text) to authenticated;
grant execute on function public.cambiar_estado_proveedor_compra(uuid, text) to authenticated;
grant execute on function public.emitir_orden_compra(uuid) to authenticated;
grant execute on function public.cancelar_orden_compra(uuid) to authenticated;
grant execute on function public.recibir_orden_compra_parcial(uuid, jsonb, text) to authenticated;
grant execute on function public.sincronizar_cuentas_pagar_compras_actual() to authenticated;
grant execute on function public.registrar_movimiento_cuenta(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.anular_cuenta_pago(uuid, text) to authenticated;
grant execute on function public.recibir_orden_compra(uuid) to authenticated;
grant execute on function public.registrar_pago_cuenta_cobrar(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.sync_payable_account_for_purchase(uuid, uuid, uuid) to service_role;
