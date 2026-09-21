-- Partial sales returns with independent financial, physical and fiscal effects.

create unique index if not exists venta_items_id_empresa_unique_idx
  on public.venta_items (id, empresa_id);

create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sale_id uuid not null,
  number text not null,
  status text not null default 'confirmed',
  reason text not null,
  currency_code text not null default 'CRC',
  subtotal_amount numeric(14, 2) not null default 0,
  discount_amount numeric(14, 2) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  financial_status text not null default 'pending',
  credited_amount numeric(14, 2) not null default 0,
  refunded_amount numeric(14, 2) not null default 0,
  financial_account_id uuid,
  financial_operation_id uuid,
  financial_request jsonb,
  financial_processed_at timestamptz,
  inventory_status text not null default 'pending',
  inventory_warehouse_id uuid,
  inventory_operation_id uuid,
  inventory_request jsonb,
  inventory_processed_at timestamptz,
  fiscal_status text not null default 'not_required',
  fiscal_document_id uuid,
  fiscal_operation_id uuid,
  creation_operation_id uuid not null,
  creation_request jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_returns_id_empresa_unique unique (id, empresa_id),
  constraint sales_returns_empresa_number_unique unique (empresa_id, number),
  constraint sales_returns_sale_empresa_fkey
    foreign key (sale_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete restrict,
  constraint sales_returns_financial_account_empresa_fkey
    foreign key (financial_account_id, empresa_id)
    references public.payments_accounts(id, empresa_id)
    on delete restrict,
  constraint sales_returns_inventory_warehouse_empresa_fkey
    foreign key (inventory_warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint sales_returns_fiscal_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete restrict,
  constraint sales_returns_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint sales_returns_status_check
    check (status in ('confirmed', 'cancelled')),
  constraint sales_returns_financial_status_check
    check (financial_status in ('pending', 'not_required', 'processed')),
  constraint sales_returns_inventory_status_check
    check (inventory_status in ('pending', 'not_required', 'processed')),
  constraint sales_returns_fiscal_status_check
    check (fiscal_status in (
      'pending', 'not_required', 'prepared', 'processing', 'accepted',
      'rejected', 'uncertain', 'error_validation'
    )),
  constraint sales_returns_amounts_check
    check (
      subtotal_amount >= 0
      and discount_amount >= 0
      and tax_amount >= 0
      and total_amount >= 0
      and credited_amount >= 0
      and refunded_amount >= 0
      and refunded_amount <= credited_amount
    ),
  constraint sales_returns_creation_request_object_check
    check (jsonb_typeof(creation_request) = 'object'),
  constraint sales_returns_financial_request_object_check
    check (financial_request is null or jsonb_typeof(financial_request) = 'object'),
  constraint sales_returns_inventory_request_object_check
    check (inventory_request is null or jsonb_typeof(inventory_request) = 'object')
);

create unique index if not exists sales_returns_empresa_creation_operation_unique
  on public.sales_returns (empresa_id, creation_operation_id);
create unique index if not exists sales_returns_empresa_financial_operation_unique
  on public.sales_returns (empresa_id, financial_operation_id)
  where financial_operation_id is not null;
create unique index if not exists sales_returns_empresa_inventory_operation_unique
  on public.sales_returns (empresa_id, inventory_operation_id)
  where inventory_operation_id is not null;
create index if not exists sales_returns_empresa_sale_created_idx
  on public.sales_returns (empresa_id, sale_id, created_at desc);
create index if not exists sales_returns_empresa_pending_idx
  on public.sales_returns (empresa_id, financial_status, inventory_status, fiscal_status)
  where status = 'confirmed';

create unique index if not exists fiscal_documents_sales_return_source_unique
  on public.fiscal_documents (empresa_id, source_type, source_id)
  where source_type = 'sales_return' and source_id is not null;

insert into public.fiscal_reference_codes (code, label, applies_to, is_active)
values
  ('01', 'Anula documento de referencia', 'all', true),
  ('02', 'Corrige texto de documento de referencia', 'all', true),
  ('04', 'Referencia a otro documento', 'all', true),
  ('05', 'Sustituye comprobante provisional por contingencia', 'all', true),
  ('99', 'Otros', 'all', true)
on conflict (code) do update
set label = excluded.label,
    applies_to = excluded.applies_to,
    is_active = excluded.is_active;

drop trigger if exists set_sales_returns_updated_at on public.sales_returns;
create trigger set_sales_returns_updated_at
before update on public.sales_returns
for each row execute function public.set_updated_at();

create table if not exists public.sales_return_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  return_id uuid not null,
  sale_item_id uuid not null,
  product_id uuid,
  description text not null,
  quantity numeric(14, 2) not null,
  physical_quantity numeric(14, 2) not null default 0,
  unit_price numeric(14, 4) not null,
  subtotal_amount numeric(14, 2) not null,
  discount_amount numeric(14, 2) not null,
  tax_amount numeric(14, 2) not null,
  total_amount numeric(14, 2) not null,
  requires_inventory boolean not null default false,
  created_at timestamptz not null default now(),
  constraint sales_return_items_id_empresa_unique unique (id, empresa_id),
  constraint sales_return_items_return_item_unique unique (return_id, sale_item_id),
  constraint sales_return_items_return_empresa_fkey
    foreign key (return_id, empresa_id)
    references public.sales_returns(id, empresa_id)
    on delete cascade,
  constraint sales_return_items_sale_item_empresa_fkey
    foreign key (sale_item_id, empresa_id)
    references public.venta_items(id, empresa_id)
    on delete restrict,
  constraint sales_return_items_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint sales_return_items_quantity_check
    check (quantity > 0 and physical_quantity >= 0 and physical_quantity <= quantity),
  constraint sales_return_items_amounts_check
    check (
      unit_price >= 0
      and subtotal_amount >= 0
      and discount_amount >= 0
      and tax_amount >= 0
      and total_amount >= 0
    )
);

create index if not exists sales_return_items_empresa_return_idx
  on public.sales_return_items (empresa_id, return_id);
create index if not exists sales_return_items_empresa_sale_item_idx
  on public.sales_return_items (empresa_id, sale_item_id);

create table if not exists public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  return_id uuid not null,
  account_id uuid not null,
  amount numeric(14, 2) not null,
  method text not null,
  reference text,
  notes text,
  status text not null default 'recorded',
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint payment_refunds_id_empresa_unique unique (id, empresa_id),
  constraint payment_refunds_return_empresa_unique unique (return_id, empresa_id),
  constraint payment_refunds_return_empresa_fkey
    foreign key (return_id, empresa_id)
    references public.sales_returns(id, empresa_id)
    on delete restrict,
  constraint payment_refunds_account_empresa_fkey
    foreign key (account_id, empresa_id)
    references public.payments_accounts(id, empresa_id)
    on delete restrict,
  constraint payment_refunds_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint payment_refunds_amount_check check (amount > 0),
  constraint payment_refunds_method_check check (method in ('cash', 'card', 'sinpe', 'transfer', 'other')),
  constraint payment_refunds_status_check check (status in ('recorded', 'reversed'))
);

create index if not exists payment_refunds_empresa_account_created_idx
  on public.payment_refunds (empresa_id, account_id, created_at desc);

alter table public.sales_returns enable row level security;
alter table public.sales_return_items enable row level security;
alter table public.payment_refunds enable row level security;

grant select on public.sales_returns, public.sales_return_items to authenticated;
grant select on public.payment_refunds to authenticated;

drop policy if exists sales_returns_select_company on public.sales_returns;
create policy sales_returns_select_company
on public.sales_returns for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('sales.orders.view'))
    or (select public.current_user_has_permission('sales.orders.edit'))
  )
);

drop policy if exists sales_return_items_select_company on public.sales_return_items;
create policy sales_return_items_select_company
on public.sales_return_items for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('sales.orders.view'))
    or (select public.current_user_has_permission('sales.orders.edit'))
  )
);

drop policy if exists payment_refunds_select_company on public.payment_refunds;
create policy payment_refunds_select_company
on public.payment_refunds for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('payments.accounts.view'))
    or (select public.current_user_has_permission('payments.accounts.manage'))
  )
);

create or replace function public.create_sales_return(
  p_operation_id uuid,
  p_sale_id uuid,
  p_reason text,
  p_items jsonb
)
returns table (
  return_id uuid,
  return_number text,
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
  v_sale public.ventas%rowtype;
  v_existing public.sales_returns%rowtype;
  v_return public.sales_returns%rowtype;
  v_sale_item public.venta_items%rowtype;
  v_item jsonb;
  v_request jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_item_id uuid;
  v_quantity numeric(14, 2);
  v_prior_quantity numeric(14, 2);
  v_prior_subtotal numeric(14, 2);
  v_prior_discount numeric(14, 2);
  v_prior_tax numeric(14, 2);
  v_prior_total numeric(14, 2);
  v_ratio numeric;
  v_sequence bigint;
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_line_subtotal numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_line_total numeric(14, 2);
  v_requires_inventory boolean;
  v_any_inventory boolean := false;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit') then
    raise exception 'Permiso sales.orders.edit requerido.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_sale_id is null then
    raise exception 'Venta e identificador idempotente requeridos.' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Motivo requerido con maximo 500 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'La devolucion requiere entre 1 y 50 lineas.' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct item->>'saleItemId')
    from jsonb_array_elements(p_items) as entry(item)
  ) then
    raise exception 'No repita lineas de venta en la devolucion.' using errcode = '22023';
  end if;

  begin
    if exists (
      select 1
      from jsonb_array_elements(p_items) as entry(item)
      where jsonb_typeof(item) <> 'object'
         or nullif(item->>'saleItemId', '') is null
         or nullif(item->>'quantity', '') is null
         or (item->>'quantity')::numeric <= 0
         or (item->>'quantity')::numeric <> round((item->>'quantity')::numeric, 2)
    ) then
      raise exception 'Cada linea requiere identificador y cantidad positiva con maximo dos decimales.'
        using errcode = '22023';
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Lineas de devolucion invalidas.' using errcode = '22023';
  end;

  begin
    select jsonb_build_object(
      'saleId', p_sale_id,
      'reason', v_reason,
      'items', jsonb_agg(
        jsonb_build_object(
          'saleItemId', (item->>'saleItemId')::uuid,
          'quantity', round((item->>'quantity')::numeric, 2)
        )
        order by item->>'saleItemId'
      )
    )
    into v_request
    from jsonb_array_elements(p_items) as entry(item);
  exception when others then
    raise exception 'Lineas de devolucion invalidas.' using errcode = '22023';
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':sales.return.create:' || p_operation_id::text, 0)
  );

  select sr.* into v_existing
  from public.sales_returns as sr
  where sr.empresa_id = v_empresa_id
    and sr.creation_operation_id = p_operation_id;

  if v_existing.id is not null then
    if v_existing.creation_request <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;
    return query select v_existing.id, v_existing.number, v_existing.total_amount, true;
    return;
  end if;

  select v.* into v_sale
  from public.ventas as v
  where v.id = p_sale_id and v.empresa_id = v_empresa_id
  for update;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;
  if v_sale.estado not in ('confirmada', 'en_proceso', 'completada') then
    raise exception 'La venta no admite devoluciones en su estado actual.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':sales.return.number', 0)
  );
  select coalesce(max((substring(sr.number from '[0-9]+$'))::bigint), 0) + 1
  into v_sequence
  from public.sales_returns as sr
  where sr.empresa_id = v_empresa_id;

  insert into public.sales_returns (
    empresa_id, sale_id, number, reason, currency_code, subtotal_amount,
    discount_amount, tax_amount, total_amount, financial_status,
    inventory_status, fiscal_status, creation_operation_id, creation_request,
    created_by
  ) values (
    v_empresa_id, p_sale_id, 'DEV-' || lpad(v_sequence::text, 8, '0'), v_reason,
    v_sale.moneda, 0, 0, 0, 0, 'pending', 'pending',
    case when exists (
      select 1 from public.fiscal_documents as fd
      where fd.empresa_id = v_empresa_id
        and fd.sale_id = p_sale_id
        and fd.document_type_code in ('01', '04')
        and fd.status not in ('error_validation', 'cancelled_internal', 'replaced')
    ) then 'pending' else 'not_required' end,
    p_operation_id, v_request, v_user_id
  ) returning * into v_return;

  for v_item in
    select value from jsonb_array_elements(v_request->'items') order by value->>'saleItemId'
  loop
    v_item_id := (v_item->>'saleItemId')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity <= 0 or v_quantity <> round(v_quantity, 2) then
      raise exception 'Cantidad de devolucion invalida.' using errcode = '22023';
    end if;

    select vi.* into v_sale_item
    from public.venta_items as vi
    where vi.id = v_item_id
      and vi.empresa_id = v_empresa_id
      and vi.venta_id = p_sale_id
    for update;
    if v_sale_item.id is null then
      raise exception 'Linea de venta no encontrada.' using errcode = '02000';
    end if;

    select
      coalesce(sum(sri.quantity), 0),
      coalesce(sum(sri.subtotal_amount), 0),
      coalesce(sum(sri.discount_amount), 0),
      coalesce(sum(sri.tax_amount), 0),
      coalesce(sum(sri.total_amount), 0)
    into v_prior_quantity, v_prior_subtotal, v_prior_discount, v_prior_tax, v_prior_total
    from public.sales_return_items as sri
    join public.sales_returns as sr
      on sr.id = sri.return_id and sr.empresa_id = sri.empresa_id
    where sri.empresa_id = v_empresa_id
      and sri.sale_item_id = v_item_id
      and sr.status <> 'cancelled';

    if v_prior_quantity + v_quantity > v_sale_item.cantidad then
      raise exception 'La cantidad devuelta supera la cantidad vendida.' using errcode = '22023';
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
    into v_requires_inventory
    from public.catalogo_productos as cp
    where cp.id = v_sale_item.producto_id and cp.empresa_id = v_empresa_id;
    v_requires_inventory := coalesce(v_requires_inventory, false)
      and v_sale.inventario_estado = 'aplicado';
    v_any_inventory := v_any_inventory or v_requires_inventory;

    insert into public.sales_return_items (
      empresa_id, return_id, sale_item_id, product_id, description, quantity,
      unit_price, subtotal_amount, discount_amount, tax_amount, total_amount,
      requires_inventory
    ) values (
      v_empresa_id, v_return.id, v_sale_item.id, v_sale_item.producto_id,
      v_sale_item.descripcion, v_quantity, v_sale_item.precio_unitario,
      v_line_subtotal, v_line_discount, v_line_tax, v_line_total,
      v_requires_inventory
    );

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
      inventory_status = case when v_any_inventory then 'pending' else 'not_required' end
  where sr.id = v_return.id and sr.empresa_id = v_empresa_id
  returning * into v_return;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_empresa_id, v_user_id, 'sales_returns', v_return.id, 'create_sales_return',
    jsonb_build_object(
      'saleId', p_sale_id,
      'number', v_return.number,
      'total', v_return.total_amount,
      'creationOperationId', p_operation_id
    )
  );

  return query select v_return.id, v_return.number, v_return.total_amount, false;
end;
$$;

create or replace function public.settle_sales_return_financial(
  p_operation_id uuid,
  p_return_id uuid,
  p_method text default 'cash',
  p_reference text default null,
  p_notes text default null
)
returns table (
  return_id uuid,
  account_id uuid,
  credited_amount numeric,
  refunded_amount numeric,
  account_balance numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.sales_returns%rowtype;
  v_account public.payments_accounts%rowtype;
  v_method text := lower(btrim(coalesce(p_method, '')));
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_request jsonb;
  v_new_total numeric(14, 2);
  v_new_balance numeric(14, 2);
  v_refund numeric(14, 2);
  v_account_status text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit')
     or not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permisos de ventas y pagos requeridos.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_return_id is null then
    raise exception 'Devolucion e identificador idempotente requeridos.' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'card', 'sinpe', 'transfer', 'other') then
    raise exception 'Metodo de reembolso no permitido.' using errcode = '22023';
  end if;
  if length(coalesce(v_reference, '')) > 160 or length(coalesce(v_notes, '')) > 1000 then
    raise exception 'Referencia o notas demasiado extensas.' using errcode = '22023';
  end if;
  v_request := jsonb_build_object(
    'returnId', p_return_id,
    'method', v_method,
    'reference', v_reference,
    'notes', v_notes
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':sales.return.financial:' || p_operation_id::text, 0)
  );

  select sr.* into v_return
  from public.sales_returns as sr
  where sr.id = p_return_id and sr.empresa_id = v_empresa_id
  for update;
  if v_return.id is null or v_return.status <> 'confirmed' then
    raise exception 'Devolucion no disponible.' using errcode = '02000';
  end if;

  if v_return.financial_operation_id is not null then
    if v_return.financial_operation_id <> p_operation_id
       or v_return.financial_request <> v_request then
      raise exception 'La devolucion financiera ya fue procesada con otra operacion.' using errcode = '23505';
    end if;
    select pa.* into v_account
    from public.payments_accounts as pa
    where pa.id = v_return.financial_account_id and pa.empresa_id = v_empresa_id;
    return query select v_return.id, v_return.financial_account_id,
      v_return.credited_amount, v_return.refunded_amount, v_account.saldo, true;
    return;
  end if;

  select pa.* into v_account
  from public.payments_accounts as pa
  where pa.empresa_id = v_empresa_id
    and pa.venta_id = v_return.sale_id
    and pa.tipo = 'receivable'
  for update;
  if v_account.id is null then
    raise exception 'Cuenta por cobrar de la venta no encontrada.' using errcode = '02000';
  end if;
  if v_return.total_amount > v_account.total then
    raise exception 'El credito supera el total vigente de la cuenta.' using errcode = '22023';
  end if;

  v_new_total := v_account.total - v_return.total_amount;
  v_new_balance := greatest(v_account.saldo - v_return.total_amount, 0);
  v_refund := greatest(v_return.total_amount - v_account.saldo, 0);
  if v_refund > 0 and v_method in ('card', 'sinpe', 'transfer') and v_reference is null then
    raise exception 'La referencia es requerida para tarjeta, SINPE o transferencia.' using errcode = '22023';
  end if;
  v_account_status := case
    when v_new_total = 0 or v_new_balance = 0 then 'pagada'
    when v_new_balance = v_new_total then 'pendiente'
    else 'parcial'
  end;

  update public.payments_accounts as pa
  set total = v_new_total,
      saldo = v_new_balance,
      estado = v_account_status,
      updated_by = v_user_id
  where pa.id = v_account.id and pa.empresa_id = v_empresa_id;

  if v_refund > 0 then
    insert into public.payment_refunds (
      empresa_id, return_id, account_id, amount, method, reference, notes, created_by
    ) values (
      v_empresa_id, v_return.id, v_account.id, v_refund, v_method,
      v_reference, v_notes, v_user_id
    );
  end if;

  update public.sales_returns as sr
  set financial_status = 'processed',
      credited_amount = v_return.total_amount,
      refunded_amount = v_refund,
      financial_account_id = v_account.id,
      financial_operation_id = p_operation_id,
      financial_request = v_request,
      financial_processed_at = now()
  where sr.id = v_return.id and sr.empresa_id = v_empresa_id
  returning * into v_return;

  update public.ventas as v
  set cobro_estado = case
        when v_new_total = 0 then 'revertido'
        when v_new_balance = 0 then 'pagado'
        when v_new_balance = v_new_total then 'pendiente'
        else 'parcial'
      end,
      actualizado_por = v_user_id
  where v.id = v_return.sale_id and v.empresa_id = v_empresa_id;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_empresa_id, v_user_id, 'sales_returns', v_return.id,
    'settle_sales_return_financial',
    jsonb_build_object(
      'accountId', v_account.id,
      'creditedAmount', v_return.total_amount,
      'refundedAmount', v_refund,
      'accountBalance', v_new_balance,
      'operationId', p_operation_id
    )
  );

  return query select v_return.id, v_account.id, v_return.total_amount,
    v_refund, v_new_balance, false;
end;
$$;

create or replace function public.apply_sales_return_inventory(
  p_operation_id uuid,
  p_return_id uuid,
  p_warehouse_id uuid
)
returns table (
  return_id uuid,
  movement_count integer,
  returned_quantity numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.sales_returns%rowtype;
  v_item public.sales_return_items%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_request jsonb;
  v_count integer := 0;
  v_quantity numeric(14, 2) := 0;
  v_full_return boolean;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit')
     or not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permisos de ventas e inventario requeridos.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_return_id is null or p_warehouse_id is null then
    raise exception 'Devolucion, bodega e identificador requeridos.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_warehouse_id and b.empresa_id = v_empresa_id and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;
  v_request := jsonb_build_object('returnId', p_return_id, 'warehouseId', p_warehouse_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':sales.return.inventory:' || p_operation_id::text, 0)
  );
  select sr.* into v_return
  from public.sales_returns as sr
  where sr.id = p_return_id and sr.empresa_id = v_empresa_id
  for update;
  if v_return.id is null or v_return.status <> 'confirmed' then
    raise exception 'Devolucion no disponible.' using errcode = '02000';
  end if;
  if v_return.inventory_status = 'not_required' then
    raise exception 'La devolucion no requiere reintegro de inventario.' using errcode = '22023';
  end if;
  if v_return.inventory_operation_id is not null then
    if v_return.inventory_operation_id <> p_operation_id
       or v_return.inventory_request <> v_request then
      raise exception 'El inventario de la devolucion ya fue procesado con otra operacion.' using errcode = '23505';
    end if;
    select count(*), coalesce(sum(sri.physical_quantity), 0)
    into v_count, v_quantity
    from public.sales_return_items as sri
    where sri.return_id = v_return.id and sri.empresa_id = v_empresa_id
      and sri.requires_inventory;
    return query select v_return.id, v_count, v_quantity, true;
    return;
  end if;

  for v_item in
    select sri.*
    from public.sales_return_items as sri
    where sri.return_id = v_return.id
      and sri.empresa_id = v_empresa_id
      and sri.requires_inventory
    order by sri.id
    for update
  loop
    insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
    values (v_empresa_id, v_item.product_id, p_warehouse_id, 0)
    on conflict on constraint inventario_stock_empresa_producto_bodega_unique do nothing;

    select s.* into v_stock
    from public.inventario_stock as s
    where s.empresa_id = v_empresa_id
      and s.producto_id = v_item.product_id
      and s.bodega_id = p_warehouse_id
    for update;

    update public.inventario_stock as s
    set cantidad = v_stock.cantidad + v_item.quantity
    where s.id = v_stock.id and s.empresa_id = v_empresa_id;

    insert into public.inventario_movimientos (
      empresa_id, producto_id, bodega_id, tipo, cantidad, cantidad_anterior,
      cantidad_nueva, motivo, referencia_tipo, referencia_id, created_by
    ) values (
      v_empresa_id, v_item.product_id, p_warehouse_id, 'entrada', v_item.quantity,
      v_stock.cantidad, v_stock.cantidad + v_item.quantity,
      'Reintegro por devolucion ' || v_return.number,
      'sales_return', v_return.id, v_user_id
    );

    update public.sales_return_items as sri
    set physical_quantity = v_item.quantity
    where sri.id = v_item.id and sri.empresa_id = v_empresa_id;
    v_count := v_count + 1;
    v_quantity := v_quantity + v_item.quantity;
  end loop;

  if v_count = 0 then
    raise exception 'No hay productos por reintegrar.' using errcode = '22023';
  end if;

  update public.sales_returns as sr
  set inventory_status = 'processed',
      inventory_warehouse_id = p_warehouse_id,
      inventory_operation_id = p_operation_id,
      inventory_request = v_request,
      inventory_processed_at = now()
  where sr.id = v_return.id and sr.empresa_id = v_empresa_id
  returning * into v_return;

  select coalesce(sum(sr.total_amount), 0) >= v.total
  into v_full_return
  from public.sales_returns as sr
  join public.ventas as v on v.id = sr.sale_id and v.empresa_id = sr.empresa_id
  where sr.empresa_id = v_empresa_id
    and sr.sale_id = v_return.sale_id
    and sr.status = 'confirmed'
  group by v.total;

  update public.ventas as v
  set entrega_estado = case when v_full_return then 'devuelto' else 'parcial' end,
      actualizado_por = v_user_id
  where v.id = v_return.sale_id and v.empresa_id = v_empresa_id;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_empresa_id, v_user_id, 'sales_returns', v_return.id,
    'apply_sales_return_inventory',
    jsonb_build_object(
      'warehouseId', p_warehouse_id,
      'movementCount', v_count,
      'returnedQuantity', v_quantity,
      'operationId', p_operation_id
    )
  );

  return query select v_return.id, v_count, v_quantity, false;
end;
$$;

create or replace function public.prepare_sales_return_credit_note(
  p_operation_id uuid,
  p_return_id uuid
)
returns table (
  return_id uuid,
  document_id uuid,
  document_status text,
  validation_errors jsonb,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.sales_returns%rowtype;
  v_original public.fiscal_documents%rowtype;
  v_document public.fiscal_documents%rowtype;
  v_reference_code text;
  v_cumulative_total numeric(14, 2);
  v_request jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.orders.edit')
     or not public.current_user_has_permission('billing.credit_note') then
    raise exception 'Permisos de ventas y nota de credito requeridos.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_return_id is null then
    raise exception 'Devolucion e identificador idempotente requeridos.' using errcode = '22023';
  end if;
  v_request := jsonb_build_object('returnId', p_return_id, 'documentTypeCode', '03');

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_empresa_id::text || ':sales.return.fiscal:' || p_operation_id::text, 0)
  );

  select sr.* into v_return
  from public.sales_returns as sr
  where sr.id = p_return_id and sr.empresa_id = v_empresa_id
  for update;

  if v_return.id is null or v_return.status <> 'confirmed' then
    raise exception 'Devolucion no disponible.' using errcode = '02000';
  end if;
  if v_return.fiscal_status = 'not_required' then
    raise exception 'La venta no requiere nota de credito fiscal.' using errcode = '22023';
  end if;
  if v_return.fiscal_operation_id is not null then
    if v_return.fiscal_operation_id <> p_operation_id then
      raise exception 'La nota de credito ya fue preparada con otra operacion.' using errcode = '23505';
    end if;
    select fd.* into v_document
    from public.fiscal_documents as fd
    where fd.id = v_return.fiscal_document_id and fd.empresa_id = v_empresa_id;
    return query select v_return.id, v_document.id, v_document.status,
      v_document.validation_errors, true;
    return;
  end if;

  select fd.* into v_original
  from public.fiscal_documents as fd
  where fd.empresa_id = v_empresa_id
    and fd.sale_id = v_return.sale_id
    and fd.document_type_code in ('01', '04')
    and (fd.status = 'accepted' or fd.hacienda_status = 'aceptado')
    and fd.clave is not null
    and fd.consecutivo is not null
  order by coalesce(fd.accepted_at, fd.updated_at) desc
  limit 1
  for update;

  if v_original.id is null then
    raise exception 'No existe un comprobante fiscal aceptado para referenciar.' using errcode = '02000';
  end if;
  if exists (
    select 1
    from public.sales_return_items as sri
    left join public.fiscal_document_lines as original_line
      on original_line.fiscal_document_id = v_original.id
     and original_line.empresa_id = sri.empresa_id
     and original_line.source_item_id = sri.sale_item_id
    where sri.empresa_id = v_empresa_id
      and sri.return_id = v_return.id
      and original_line.id is null
  ) then
    raise exception 'El comprobante original no contiene todas las lineas devueltas.' using errcode = '22023';
  end if;

  select coalesce(sum(sr.total_amount), 0)
  into v_cumulative_total
  from public.sales_returns as sr
  where sr.empresa_id = v_empresa_id
    and sr.sale_id = v_return.sale_id
    and sr.status = 'confirmed';
  v_reference_code := case
    when v_cumulative_total >= (
      select v.total from public.ventas as v
      where v.id = v_return.sale_id and v.empresa_id = v_empresa_id
    ) then '01'
    else '04'
  end;

  insert into public.fiscal_documents (
    empresa_id, source_type, source_id, sale_id, customer_id,
    document_type_code, status, hacienda_status, environment, activity_code,
    branch_code, terminal_code, issue_datetime, currency_code, exchange_rate,
    sale_condition_code, credit_term_days, receiver_name,
    receiver_identification_type, receiver_identification_number,
    receiver_email, receiver_phone, receiver_address, issuer_snapshot,
    receiver_snapshot, totals, validation_errors, metadata, created_by
  ) values (
    v_empresa_id, 'sales_return', v_return.id, v_return.sale_id,
    v_original.customer_id, '03', 'validated', 'no_enviado',
    v_original.environment, v_original.activity_code, v_original.branch_code,
    v_original.terminal_code, now(), v_return.currency_code,
    v_original.exchange_rate, v_original.sale_condition_code,
    v_original.credit_term_days, v_original.receiver_name,
    v_original.receiver_identification_type,
    v_original.receiver_identification_number, v_original.receiver_email,
    v_original.receiver_phone, v_original.receiver_address,
    v_original.issuer_snapshot, v_original.receiver_snapshot,
    jsonb_build_object(
      'totalVenta', v_return.subtotal_amount + v_return.discount_amount,
      'totalDescuentos', v_return.discount_amount,
      'totalVentaNeta', v_return.subtotal_amount,
      'totalImpuestos', v_return.tax_amount,
      'totalComprobante', v_return.total_amount
    ),
    '[]'::jsonb,
    jsonb_build_object(
      'salesReturnId', v_return.id,
      'salesReturnNumber', v_return.number,
      'originalFiscalDocumentId', v_original.id,
      'fiscalOperationId', p_operation_id
    ),
    v_user_id
  ) returning * into v_document;

  -- Preserve the accepted document snapshots even if the current customer profile changed.
  update public.fiscal_documents as fd
  set receiver_name = v_original.receiver_name,
      receiver_identification_type = v_original.receiver_identification_type,
      receiver_identification_number = v_original.receiver_identification_number,
      receiver_email = v_original.receiver_email,
      receiver_phone = v_original.receiver_phone,
      receiver_address = v_original.receiver_address,
      receiver_snapshot = v_original.receiver_snapshot
  where fd.id = v_document.id and fd.empresa_id = v_empresa_id
  returning * into v_document;

  insert into public.fiscal_document_lines (
    fiscal_document_id, empresa_id, line_number, source_item_id, product_id,
    cabys_code, commercial_code, quantity, unit_code, commercial_unit,
    detail, unit_price, gross_amount, discount_amount, discount_reason,
    subtotal, taxable_base, tax_amount, total_line_amount, is_good,
    is_service, is_exempt, is_non_subject, metadata
  )
  select
    v_document.id, v_empresa_id,
    row_number() over (order by sri.created_at, sri.id)::integer,
    sri.id, sri.product_id, original_line.cabys_code,
    original_line.commercial_code, sri.quantity, original_line.unit_code,
    original_line.commercial_unit, sri.description, original_line.unit_price,
    sri.subtotal_amount + sri.discount_amount, sri.discount_amount,
    case when sri.discount_amount > 0 then 'Descuento proporcional del documento original' else null end,
    sri.subtotal_amount,
    case when original_line.taxable_base is null then null else sri.subtotal_amount end,
    sri.tax_amount, sri.total_amount, original_line.is_good,
    original_line.is_service, original_line.is_exempt,
    original_line.is_non_subject,
    coalesce(original_line.metadata, '{}'::jsonb) || jsonb_build_object(
      'originalFiscalLineId', original_line.id,
      'originalSaleItemId', sri.sale_item_id,
      'salesReturnItemId', sri.id
    )
  from public.sales_return_items as sri
  join public.fiscal_document_lines as original_line
    on original_line.fiscal_document_id = v_original.id
   and original_line.empresa_id = sri.empresa_id
   and original_line.source_item_id = sri.sale_item_id
  where sri.empresa_id = v_empresa_id
    and sri.return_id = v_return.id
  order by sri.created_at, sri.id;

  insert into public.fiscal_document_line_taxes (
    fiscal_document_line_id, empresa_id, tax_code, tax_rate_code, rate,
    amount, taxable_base, metadata
  )
  select
    new_line.id, v_empresa_id, original_tax.tax_code,
    original_tax.tax_rate_code, original_tax.rate,
    case
      when original_line.tax_amount > 0
        then round(original_tax.amount * return_item.tax_amount / original_line.tax_amount, 4)
      else 0
    end,
    case when original_tax.taxable_base is null then null else return_item.subtotal_amount end,
    coalesce(original_tax.metadata, '{}'::jsonb) || jsonb_build_object(
      'originalFiscalTaxId', original_tax.id
    )
  from public.fiscal_document_lines as new_line
  join public.sales_return_items as return_item
    on return_item.id = new_line.source_item_id
   and return_item.empresa_id = new_line.empresa_id
  join public.fiscal_document_lines as original_line
    on original_line.fiscal_document_id = v_original.id
   and original_line.empresa_id = return_item.empresa_id
   and original_line.source_item_id = return_item.sale_item_id
  join public.fiscal_document_line_taxes as original_tax
    on original_tax.fiscal_document_line_id = original_line.id
   and original_tax.empresa_id = original_line.empresa_id
  where new_line.fiscal_document_id = v_document.id
    and new_line.empresa_id = v_empresa_id
    and return_item.tax_amount > 0;

  insert into public.fiscal_document_references (
    fiscal_document_id, empresa_id, reference_document_type_code,
    reference_clave, reference_consecutivo, reference_issue_date,
    reference_code, reason, metadata
  ) values (
    v_document.id, v_empresa_id, v_original.document_type_code,
    v_original.clave, v_original.consecutivo, v_original.issue_datetime,
    v_reference_code,
    case when v_reference_code = '01'
      then 'Devolucion total ' || v_return.number
      else 'Devolucion parcial ' || v_return.number
    end,
    jsonb_build_object('originalFiscalDocumentId', v_original.id)
  );

  insert into public.fiscal_document_events (
    fiscal_document_id, empresa_id, event_type, from_status, to_status,
    message, details, created_by
  ) values (
    v_document.id, v_empresa_id, 'prepared_from_sales_return', null,
    v_document.status, 'Nota de credito preparada desde devolucion.',
    jsonb_build_object(
      'salesReturnId', v_return.id,
      'originalFiscalDocumentId', v_original.id,
      'referenceCode', v_reference_code,
      'operationId', p_operation_id
    ),
    v_user_id
  );

  update public.sales_returns as sr
  set fiscal_status = case
        when v_document.status = 'error_validation' then 'error_validation'
        else 'prepared'
      end,
      fiscal_document_id = v_document.id,
      fiscal_operation_id = p_operation_id
  where sr.id = v_return.id and sr.empresa_id = v_empresa_id
  returning * into v_return;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_empresa_id, v_user_id, 'sales_returns', v_return.id,
    'prepare_sales_return_credit_note',
    jsonb_build_object(
      'documentId', v_document.id,
      'documentStatus', v_document.status,
      'originalFiscalDocumentId', v_original.id,
      'operationId', p_operation_id
    )
  );

  return query select v_return.id, v_document.id, v_document.status,
    v_document.validation_errors, false;
end;
$$;

revoke all on function public.create_sales_return(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.settle_sales_return_financial(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.apply_sales_return_inventory(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.prepare_sales_return_credit_note(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_sales_return(uuid, uuid, text, jsonb)
  to authenticated;
grant execute on function public.settle_sales_return_financial(uuid, uuid, text, text, text)
  to authenticated;
grant execute on function public.apply_sales_return_inventory(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.prepare_sales_return_credit_note(uuid, uuid)
  to authenticated;

comment on table public.sales_returns is
  'Partial commercial returns whose financial, physical and fiscal effects are tracked independently.';
