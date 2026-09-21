-- Audited, idempotent physical inventory counts with a controlled warehouse freeze.

create table if not exists public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  warehouse_id uuid not null,
  count_number text not null,
  status text not null default 'open',
  notes text,
  total_items integer not null default 0,
  counted_items integer not null default 0,
  adjustment_items integer not null default 0,
  opened_by uuid,
  opened_at timestamptz not null default now(),
  closed_by uuid,
  closed_at timestamptz,
  cancelled_by uuid,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_counts_id_empresa_unique unique (id, empresa_id),
  constraint inventory_counts_number_unique unique (empresa_id, count_number),
  constraint inventory_counts_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint inventory_counts_opened_by_empresa_fkey
    foreign key (opened_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (opened_by),
  constraint inventory_counts_closed_by_empresa_fkey
    foreign key (closed_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (closed_by),
  constraint inventory_counts_cancelled_by_empresa_fkey
    foreign key (cancelled_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (cancelled_by),
  constraint inventory_counts_status_check
    check (status in ('open', 'closed', 'cancelled')),
  constraint inventory_counts_totals_check
    check (
      total_items >= 0
      and counted_items >= 0
      and counted_items <= total_items
      and adjustment_items >= 0
      and adjustment_items <= total_items
    )
);

create unique index if not exists inventory_counts_one_open_warehouse_idx
  on public.inventory_counts (empresa_id, warehouse_id)
  where status = 'open';
create index if not exists inventory_counts_company_opened_idx
  on public.inventory_counts (empresa_id, opened_at desc);
create index if not exists inventory_counts_warehouse_empresa_fkey_idx
  on public.inventory_counts (warehouse_id, empresa_id);
create index if not exists inventory_counts_opened_by_empresa_fkey_idx
  on public.inventory_counts (opened_by, empresa_id);
create index if not exists inventory_counts_closed_by_empresa_fkey_idx
  on public.inventory_counts (closed_by, empresa_id);
create index if not exists inventory_counts_cancelled_by_empresa_fkey_idx
  on public.inventory_counts (cancelled_by, empresa_id);

create table if not exists public.inventory_count_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  count_id uuid not null,
  stock_id uuid not null references public.inventario_stock(id) on delete restrict,
  product_id uuid not null,
  expected_quantity numeric(14, 2) not null,
  counted_quantity numeric(14, 2),
  variance_quantity numeric(14, 2),
  snapshot_average_unit_cost numeric(14, 6),
  snapshot_cost_status text not null,
  notes text,
  counted_by uuid,
  counted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_count_items_id_empresa_unique unique (id, empresa_id),
  constraint inventory_count_items_count_product_unique
    unique (empresa_id, count_id, product_id),
  constraint inventory_count_items_count_empresa_fkey
    foreign key (count_id, empresa_id)
    references public.inventory_counts(id, empresa_id)
    on delete cascade,
  constraint inventory_count_items_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint inventory_count_items_counted_by_empresa_fkey
    foreign key (counted_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (counted_by),
  constraint inventory_count_items_quantities_check
    check (
      expected_quantity >= 0
      and (counted_quantity is null or counted_quantity >= 0)
      and (
        (counted_quantity is null and variance_quantity is null)
        or (
          counted_quantity is not null
          and variance_quantity is not null
          and variance_quantity = counted_quantity - expected_quantity
        )
      )
    ),
  constraint inventory_count_items_cost_check
    check (
      snapshot_cost_status in ('complete', 'incomplete')
      and (snapshot_average_unit_cost is null or snapshot_average_unit_cost >= 0)
    )
);

create index if not exists inventory_count_items_count_idx
  on public.inventory_count_items (empresa_id, count_id, created_at);
create index if not exists inventory_count_items_stock_idx
  on public.inventory_count_items (empresa_id, stock_id);
create index if not exists inventory_count_items_product_empresa_fkey_idx
  on public.inventory_count_items (product_id, empresa_id);
create index if not exists inventory_count_items_counted_by_empresa_fkey_idx
  on public.inventory_count_items (counted_by, empresa_id);

alter table public.inventory_counts enable row level security;
alter table public.inventory_count_items enable row level security;

revoke all on table public.inventory_counts from public, anon, authenticated;
revoke all on table public.inventory_count_items from public, anon, authenticated;
grant select on table public.inventory_counts to authenticated;
grant select on table public.inventory_count_items to authenticated;

drop policy if exists inventory_counts_select_permission
  on public.inventory_counts;
create policy inventory_counts_select_permission
on public.inventory_counts for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('inventory.stock.view'))
    or (select public.current_user_has_permission('inventory.stock.adjust'))
  )
);

drop policy if exists inventory_count_items_select_permission
  on public.inventory_count_items;
create policy inventory_count_items_select_permission
on public.inventory_count_items for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('inventory.stock.view'))
    or (select public.current_user_has_permission('inventory.stock.adjust'))
  )
);

create or replace function public.guard_inventory_physical_count_freeze()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_warehouse_id uuid;
  v_allowed_count_id uuid;
  v_open_count_id uuid;
begin
  if tg_op = 'UPDATE' and new.cantidad = old.cantidad then
    return new;
  end if;

  v_company_id := case when tg_op = 'INSERT' then new.empresa_id else old.empresa_id end;
  v_warehouse_id := case when tg_op = 'INSERT' then new.bodega_id else old.bodega_id end;

  begin
    v_allowed_count_id := nullif(current_setting('app.inventory_count_close_id', true), '')::uuid;
  exception when invalid_text_representation then
    v_allowed_count_id := null;
  end;

  select c.id into v_open_count_id
  from public.inventory_counts as c
  where c.empresa_id = v_company_id
    and c.warehouse_id = v_warehouse_id
    and c.status = 'open'
  limit 1;

  if v_open_count_id is not null
     and v_open_count_id is distinct from v_allowed_count_id then
    raise exception 'La bodega tiene un conteo físico abierto. Ciérralo o cancélalo antes de mover existencias.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_inventory_count_stock_update
  on public.inventario_stock;
create trigger guard_inventory_count_stock_update
before update of cantidad on public.inventario_stock
for each row execute function public.guard_inventory_physical_count_freeze();

drop trigger if exists guard_inventory_count_stock_insert_delete
  on public.inventario_stock;
create trigger guard_inventory_count_stock_insert_delete
before insert or delete on public.inventario_stock
for each row execute function public.guard_inventory_physical_count_freeze();

revoke all on function public.guard_inventory_physical_count_freeze()
  from public, anon, authenticated, service_role;

create or replace function public.start_inventory_physical_count(
  p_operation_id uuid,
  p_warehouse_id uuid,
  p_notes text default null
)
returns table (
  count_id uuid,
  count_number text,
  total_items integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_count public.inventory_counts%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_request jsonb;
  v_total integer;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_warehouse_id is null then
    raise exception 'Operación y bodega son requeridas.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'warehouse_id', p_warehouse_id,
    'notes', nullif(btrim(coalesce(p_notes, '')), '')
  );

  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':inventory.count.start:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'inventory.count.start'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'count_id')::uuid,
      v_receipt.result_payload->>'count_number',
      (v_receipt.result_payload->>'total_items')::integer,
      true;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':inventory.count.warehouse:' || p_warehouse_id::text, 0)
  );

  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_warehouse_id
      and b.empresa_id = v_company_id
      and b.estado = 'activa'
  ) then
    raise exception 'Bodega activa no encontrada.' using errcode = '02000';
  end if;

  if exists (
    select 1 from public.inventory_counts as c
    where c.empresa_id = v_company_id
      and c.warehouse_id = p_warehouse_id
      and c.status = 'open'
  ) then
    raise exception 'La bodega ya tiene un conteo físico abierto.' using errcode = '23505';
  end if;

  v_count.id := gen_random_uuid();
  v_count.count_number := 'CNT-' || to_char(current_date, 'YYYY') || '-'
    || upper(substr(replace(v_count.id::text, '-', ''), 1, 8));

  insert into public.inventory_counts (
    id, empresa_id, warehouse_id, count_number, notes, opened_by
  ) values (
    v_count.id,
    v_company_id,
    p_warehouse_id,
    v_count.count_number,
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_user_id
  ) returning * into v_count;

  insert into public.inventory_count_items (
    empresa_id,
    count_id,
    stock_id,
    product_id,
    expected_quantity,
    snapshot_average_unit_cost,
    snapshot_cost_status
  )
  select
    v_company_id,
    v_count.id,
    s.id,
    s.producto_id,
    s.cantidad,
    s.average_unit_cost,
    s.cost_status
  from public.inventario_stock as s
  where s.empresa_id = v_company_id
    and s.bodega_id = p_warehouse_id
  order by s.producto_id;

  get diagnostics v_total = row_count;

  update public.inventory_counts as c
  set total_items = v_total, updated_at = now()
  where c.id = v_count.id and c.empresa_id = v_company_id;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'inventory.count.start',
    p_operation_id::text,
    v_request,
    jsonb_build_object(
      'count_id', v_count.id,
      'count_number', v_count.count_number,
      'total_items', v_total
    ),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id,
    v_user_id,
    'inventory_counts',
    v_count.id,
    'start_inventory_physical_count',
    jsonb_build_object(
      'warehouse_id', p_warehouse_id,
      'count_number', v_count.count_number,
      'total_items', v_total
    )
  );

  return query select v_count.id, v_count.count_number, v_total, false;
end;
$$;

create or replace function public.record_inventory_count_item(
  p_count_id uuid,
  p_item_id uuid,
  p_counted_quantity numeric,
  p_notes text default null
)
returns table (
  count_id uuid,
  item_id uuid,
  counted_quantity numeric,
  variance_quantity numeric,
  counted_items integer,
  total_items integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_count public.inventory_counts%rowtype;
  v_item public.inventory_count_items%rowtype;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_counted_quantity is null or p_counted_quantity < 0 then
    raise exception 'La cantidad contada debe ser mayor o igual a cero.' using errcode = '22023';
  end if;

  select c.* into v_count
  from public.inventory_counts as c
  where c.id = p_count_id and c.empresa_id = v_company_id
  for update;

  if v_count.id is null then
    raise exception 'Conteo físico no encontrado.' using errcode = '02000';
  end if;
  if v_count.status <> 'open' then
    raise exception 'El conteo físico ya no está abierto.' using errcode = '22023';
  end if;

  select ci.* into v_item
  from public.inventory_count_items as ci
  where ci.id = p_item_id
    and ci.count_id = p_count_id
    and ci.empresa_id = v_company_id
  for update;

  if v_item.id is null then
    raise exception 'Producto del conteo no encontrado.' using errcode = '02000';
  end if;

  update public.inventory_count_items as ci
  set
    counted_quantity = round(p_counted_quantity, 2),
    variance_quantity = round(p_counted_quantity, 2) - ci.expected_quantity,
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    counted_by = v_user_id,
    counted_at = now(),
    updated_at = now()
  where ci.id = v_item.id and ci.empresa_id = v_company_id
  returning * into v_item;

  update public.inventory_counts as c
  set
    counted_items = (
      select count(*)::integer
      from public.inventory_count_items as ci
      where ci.empresa_id = v_company_id
        and ci.count_id = v_count.id
        and ci.counted_quantity is not null
    ),
    updated_at = now()
  where c.id = v_count.id and c.empresa_id = v_company_id
  returning * into v_count;

  return query select
    v_count.id,
    v_item.id,
    v_item.counted_quantity,
    v_item.variance_quantity,
    v_count.counted_items,
    v_count.total_items;
end;
$$;

create or replace function public.close_inventory_physical_count(
  p_operation_id uuid,
  p_count_id uuid
)
returns table (
  count_id uuid,
  count_number text,
  adjustment_items integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_count public.inventory_counts%rowtype;
  v_item public.inventory_count_items%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_request jsonb;
  v_adjustments integer := 0;
  v_movement_id uuid;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_count_id is null then
    raise exception 'Operación y conteo son requeridos.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('count_id', p_count_id);
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':inventory.count.close:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'inventory.count.close'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'count_id')::uuid,
      v_receipt.result_payload->>'count_number',
      (v_receipt.result_payload->>'adjustment_items')::integer,
      true;
    return;
  end if;

  select c.* into v_count
  from public.inventory_counts as c
  where c.id = p_count_id and c.empresa_id = v_company_id
  for update;

  if v_count.id is null then
    raise exception 'Conteo físico no encontrado.' using errcode = '02000';
  end if;
  if v_count.status <> 'open' then
    raise exception 'El conteo físico ya no está abierto.' using errcode = '22023';
  end if;
  if v_count.counted_items <> v_count.total_items then
    raise exception 'Debes registrar todos los productos antes de cerrar el conteo.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':inventory.count.warehouse:' || v_count.warehouse_id::text, 0)
  );

  if exists (
    select 1
    from public.inventory_count_items as ci
    join public.inventario_stock as s
      on s.id = ci.stock_id and s.empresa_id = ci.empresa_id
    where ci.empresa_id = v_company_id
      and ci.count_id = v_count.id
      and s.cantidad <> ci.expected_quantity
  ) then
    raise exception 'Las existencias cambiaron durante el conteo. Cancélalo y vuelve a iniciarlo.'
      using errcode = '40001';
  end if;

  perform set_config('app.inventory_count_close_id', v_count.id::text, true);

  for v_item in
    select ci.*
    from public.inventory_count_items as ci
    where ci.empresa_id = v_company_id
      and ci.count_id = v_count.id
      and ci.variance_quantity <> 0
    order by ci.created_at, ci.id
    for update
  loop
    update public.inventario_stock as s
    set cantidad = v_item.counted_quantity
    where s.id = v_item.stock_id and s.empresa_id = v_company_id;

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
      source_item_id,
      created_by
    ) values (
      v_company_id,
      v_item.product_id,
      v_count.warehouse_id,
      'ajuste',
      abs(v_item.variance_quantity),
      v_item.expected_quantity,
      v_item.counted_quantity,
      'Ajuste por conteo físico ' || v_count.count_number,
      'inventory_count',
      v_count.id,
      v_item.id,
      v_user_id
    ) returning id into v_movement_id;

    if v_item.variance_quantity > 0
       and v_item.snapshot_cost_status = 'complete'
       and v_item.snapshot_average_unit_cost is not null then
      update public.inventario_stock as s
      set
        average_unit_cost = v_item.snapshot_average_unit_cost,
        cost_status = 'complete'
      where s.id = v_item.stock_id and s.empresa_id = v_company_id;

      update public.inventario_movimientos as im
      set
        unit_cost = v_item.snapshot_average_unit_cost,
        total_cost = round(abs(v_item.variance_quantity) * v_item.snapshot_average_unit_cost, 2),
        average_cost_before = v_item.snapshot_average_unit_cost,
        average_cost_after = v_item.snapshot_average_unit_cost,
        cost_status = 'complete'
      where im.id = v_movement_id and im.empresa_id = v_company_id;
    end if;

    v_adjustments := v_adjustments + 1;
  end loop;

  update public.inventory_counts as c
  set
    status = 'closed',
    adjustment_items = v_adjustments,
    closed_by = v_user_id,
    closed_at = now(),
    updated_at = now()
  where c.id = v_count.id and c.empresa_id = v_company_id
  returning * into v_count;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'inventory.count.close',
    p_operation_id::text,
    v_request,
    jsonb_build_object(
      'count_id', v_count.id,
      'count_number', v_count.count_number,
      'adjustment_items', v_adjustments
    ),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id,
    v_user_id,
    'inventory_counts',
    v_count.id,
    'close_inventory_physical_count',
    jsonb_build_object(
      'count_number', v_count.count_number,
      'adjustment_items', v_adjustments
    )
  );

  return query select v_count.id, v_count.count_number, v_adjustments, false;
end;
$$;

create or replace function public.cancel_inventory_physical_count(
  p_operation_id uuid,
  p_count_id uuid
)
returns table (
  count_id uuid,
  count_number text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_count public.inventory_counts%rowtype;
  v_receipt public.business_operation_receipts%rowtype;
  v_request jsonb;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;
  if p_operation_id is null or p_count_id is null then
    raise exception 'Operación y conteo son requeridos.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('count_id', p_count_id);
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':inventory.count.cancel:' || p_operation_id::text, 0)
  );

  select r.* into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_company_id
    and r.scope = 'inventory.count.cancel'
    and r.idempotency_key = p_operation_id::text;

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La operación ya fue usada con datos diferentes.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'count_id')::uuid,
      v_receipt.result_payload->>'count_number',
      true;
    return;
  end if;

  select c.* into v_count
  from public.inventory_counts as c
  where c.id = p_count_id and c.empresa_id = v_company_id
  for update;

  if v_count.id is null then
    raise exception 'Conteo físico no encontrado.' using errcode = '02000';
  end if;
  if v_count.status <> 'open' then
    raise exception 'El conteo físico ya no está abierto.' using errcode = '22023';
  end if;

  update public.inventory_counts as c
  set
    status = 'cancelled',
    cancelled_by = v_user_id,
    cancelled_at = now(),
    updated_at = now()
  where c.id = v_count.id and c.empresa_id = v_company_id
  returning * into v_count;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id,
    'inventory.count.cancel',
    p_operation_id::text,
    v_request,
    jsonb_build_object('count_id', v_count.id, 'count_number', v_count.count_number),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id,
    v_user_id,
    'inventory_counts',
    v_count.id,
    'cancel_inventory_physical_count',
    jsonb_build_object('count_number', v_count.count_number)
  );

  return query select v_count.id, v_count.count_number, false;
end;
$$;

revoke all on function public.start_inventory_physical_count(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.record_inventory_count_item(uuid, uuid, numeric, text)
  from public, anon, authenticated, service_role;
revoke all on function public.close_inventory_physical_count(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.cancel_inventory_physical_count(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.start_inventory_physical_count(uuid, uuid, text)
  to authenticated;
grant execute on function public.record_inventory_count_item(uuid, uuid, numeric, text)
  to authenticated;
grant execute on function public.close_inventory_physical_count(uuid, uuid)
  to authenticated;
grant execute on function public.cancel_inventory_physical_count(uuid, uuid)
  to authenticated;

comment on table public.inventory_counts
  is 'Physical warehouse counts that freeze quantity changes until close or cancellation.';
comment on function public.start_inventory_physical_count(uuid, uuid, text)
  is 'Starts one idempotent physical count per warehouse and snapshots its stock.';
comment on function public.close_inventory_physical_count(uuid, uuid)
  is 'Applies counted differences atomically and records audited inventory adjustments.';
