-- Transactional point of sale with durable client-operation deduplication,
-- cash sessions, split payments, fiscal outbox dispatch and offline stock quotas.

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('sales.pos.use', 'Usar punto de venta', 'Permite abrir una caja y registrar ventas POS.', 'sales', 'activo'),
  ('sales.pos.manage', 'Administrar punto de venta', 'Permite crear terminales y administrar sesiones POS.', 'sales', 'activo'),
  ('sales.pos.refund', 'Procesar devoluciones POS', 'Permite registrar devoluciones vinculadas a ventas POS.', 'sales', 'activo'),
  ('sales.cash.manage', 'Administrar caja', 'Permite entradas, salidas, verificaciones y cierres de caja.', 'sales', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p on p.codigo = any(
  case
    when r.nombre in ('Administrador', 'Super Admin') then
      array['sales.pos.use', 'sales.pos.manage', 'sales.pos.refund', 'sales.cash.manage']::text[]
    when r.nombre = 'Supervisor' then
      array['sales.pos.use', 'sales.pos.manage', 'sales.cash.manage']::text[]
    when r.nombre = 'Vendedor' then
      array['sales.pos.use']::text[]
    when r.nombre = 'Contabilidad / Facturacion' then
      array['sales.cash.manage']::text[]
    else array[]::text[]
  end
)
where r.es_sistema = true
on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;

insert into public.roles (empresa_id, nombre, descripcion, es_sistema, estado)
select e.id, 'Cajero', 'Opera terminales de punto de venta y caja.', true, 'activo'
from public.empresas as e
where not exists (
  select 1 from public.roles as r
  where r.empresa_id = e.id and lower(r.nombre) = 'cajero'
);

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'sales.orders.view',
    'catalog.products.view',
    'inventory.stock.view',
    'sales.pos.use'
  )
where r.es_sistema = true and r.nombre = 'Cajero'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;

create or replace function public.provision_pos_cashier_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id uuid;
begin
  insert into public.roles (empresa_id, nombre, descripcion, es_sistema, estado)
  values (new.id, 'Cajero', 'Opera terminales de punto de venta y caja.', true, 'activo')
  on conflict do nothing;

  select r.id into v_role_id
  from public.roles as r
  where r.empresa_id = new.id and lower(r.nombre) = 'cajero'
  limit 1;

  insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
  select new.id, v_role_id, p.id
  from public.permisos as p
  where p.codigo in (
    'sales.orders.view',
    'catalog.products.view',
    'inventory.stock.view',
    'sales.pos.use'
  )
  on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;

  return new;
end;
$$;

drop trigger if exists provision_pos_cashier_role_after_company on public.empresas;
create trigger provision_pos_cashier_role_after_company
after insert on public.empresas
for each row execute function public.provision_pos_cashier_role();

alter table public.ventas
  add column if not exists origen text not null default 'backoffice',
  add column if not exists cobro_estado text not null default 'pendiente',
  add column if not exists entrega_estado text not null default 'pendiente',
  add column if not exists fiscal_estado text not null default 'no_solicitado';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ventas_origen_check') then
    alter table public.ventas add constraint ventas_origen_check
      check (origen in ('backoffice', 'quote', 'pos', 'api'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_cobro_estado_check') then
    alter table public.ventas add constraint ventas_cobro_estado_check
      check (cobro_estado in ('pendiente', 'parcial', 'pagado', 'revertido'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_entrega_estado_check') then
    alter table public.ventas add constraint ventas_entrega_estado_check
      check (entrega_estado in ('pendiente', 'reservado', 'preparacion', 'parcial', 'entregado', 'devuelto', 'no_aplica'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ventas_fiscal_estado_check') then
    alter table public.ventas add constraint ventas_fiscal_estado_check
      check (fiscal_estado in ('no_solicitado', 'pendiente', 'procesando', 'aceptado', 'rechazado', 'por_confirmar', 'anulado'));
  end if;
end;
$$;

create table if not exists public.pos_terminals (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sucursal_id uuid,
  warehouse_id uuid not null,
  code text not null,
  name text not null,
  status text not null default 'active',
  offline_enabled boolean not null default true,
  offline_session_hours integer not null default 8,
  offline_stock_fraction numeric(5, 4) not null default 0.10,
  offline_stock_cap numeric(14, 2) not null default 20,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_terminals_status_check check (status in ('active', 'disabled', 'lost')),
  constraint pos_terminals_hours_check check (offline_session_hours between 1 and 24),
  constraint pos_terminals_fraction_check check (offline_stock_fraction between 0 and 1),
  constraint pos_terminals_cap_check check (offline_stock_cap >= 0),
  constraint pos_terminals_company_code_unique unique (empresa_id, code),
  constraint pos_terminals_id_empresa_unique unique (id, empresa_id),
  constraint pos_terminals_branch_empresa_fkey
    foreign key (sucursal_id, empresa_id) references public.sucursales(id, empresa_id)
    on delete set null (sucursal_id),
  constraint pos_terminals_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id) references public.inventario_bodegas(id, empresa_id)
    on delete restrict,
  constraint pos_terminals_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint pos_terminals_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create table if not exists public.pos_sessions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  terminal_id uuid not null,
  status text not null default 'open',
  opened_by uuid not null,
  closed_by uuid,
  opened_at timestamptz not null default now(),
  authorized_until timestamptz not null,
  closed_at timestamptz,
  opening_cash numeric(14, 2) not null default 0,
  expected_cash numeric(14, 2),
  counted_cash numeric(14, 2),
  cash_difference numeric(14, 2),
  last_sequence integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos_sessions_status_check check (status in ('open', 'pending_sync', 'closed', 'cancelled')),
  constraint pos_sessions_opening_cash_check check (opening_cash >= 0),
  constraint pos_sessions_last_sequence_check check (last_sequence >= 0),
  constraint pos_sessions_id_empresa_unique unique (id, empresa_id),
  constraint pos_sessions_terminal_empresa_fkey
    foreign key (terminal_id, empresa_id) references public.pos_terminals(id, empresa_id)
    on delete restrict,
  constraint pos_sessions_opened_by_empresa_fkey
    foreign key (opened_by, empresa_id) references public.profiles(id, empresa_id)
    on delete restrict,
  constraint pos_sessions_closed_by_empresa_fkey
    foreign key (closed_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (closed_by)
);

create unique index if not exists pos_sessions_one_current_terminal_idx
  on public.pos_sessions (empresa_id, terminal_id)
  where status in ('open', 'pending_sync');

create index if not exists pos_sessions_company_status_idx
  on public.pos_sessions (empresa_id, status, opened_at desc);

create table if not exists public.pos_session_catalog (
  session_id uuid not null,
  empresa_id uuid not null,
  product_id uuid not null,
  product_type text not null,
  code text,
  name text not null,
  unit text not null,
  currency text not null,
  unit_price numeric(14, 2) not null,
  tax_rate numeric(5, 2) not null,
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (session_id, product_id),
  constraint pos_session_catalog_session_empresa_fkey
    foreign key (session_id, empresa_id) references public.pos_sessions(id, empresa_id)
    on delete cascade,
  constraint pos_session_catalog_product_empresa_fkey
    foreign key (product_id, empresa_id) references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint pos_session_catalog_type_check check (product_type in ('producto', 'servicio')),
  constraint pos_session_catalog_price_check check (unit_price >= 0),
  constraint pos_session_catalog_tax_check check (tax_rate between 0 and 100)
);

create index if not exists pos_session_catalog_search_idx
  on public.pos_session_catalog (empresa_id, session_id, name);

create table if not exists public.pos_stock_allocations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  session_id uuid not null,
  product_id uuid not null,
  warehouse_id uuid not null,
  allocated_quantity numeric(14, 2) not null,
  consumed_quantity numeric(14, 2) not null default 0,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pos_stock_allocations_quantities_check
    check (allocated_quantity >= 0 and consumed_quantity >= 0 and consumed_quantity <= allocated_quantity),
  constraint pos_stock_allocations_company_session_product_unique
    unique (empresa_id, session_id, product_id),
  constraint pos_stock_allocations_session_empresa_fkey
    foreign key (session_id, empresa_id) references public.pos_sessions(id, empresa_id)
    on delete cascade,
  constraint pos_stock_allocations_product_empresa_fkey
    foreign key (product_id, empresa_id) references public.catalogo_productos(id, empresa_id)
    on delete restrict,
  constraint pos_stock_allocations_warehouse_empresa_fkey
    foreign key (warehouse_id, empresa_id) references public.inventario_bodegas(id, empresa_id)
    on delete restrict
);

create index if not exists pos_stock_allocations_active_idx
  on public.pos_stock_allocations (empresa_id, warehouse_id, product_id)
  where released_at is null;

create or replace function public.guard_pos_stock_reservations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserved numeric(14, 2);
begin
  if new.cantidad >= old.cantidad then return new; end if;

  select coalesce(sum(a.allocated_quantity - a.consumed_quantity), 0)
  into v_reserved
  from public.pos_stock_allocations as a
  join public.pos_sessions as s
    on s.id = a.session_id and s.empresa_id = a.empresa_id
  where a.empresa_id = new.empresa_id
    and a.warehouse_id = new.bodega_id
    and a.product_id = new.producto_id
    and a.released_at is null
    and s.status in ('open', 'pending_sync');

  if new.cantidad < v_reserved then
    raise exception 'La salida consumiría existencias reservadas para terminales POS.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_pos_stock_reservations() from public, anon, authenticated;

drop trigger if exists guard_pos_stock_reservations_before_update on public.inventario_stock;
create trigger guard_pos_stock_reservations_before_update
before update of cantidad on public.inventario_stock
for each row execute function public.guard_pos_stock_reservations();

create table if not exists public.pos_sale_counters (
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  sale_year integer not null,
  next_value integer not null default 1,
  primary key (empresa_id, sale_year),
  constraint pos_sale_counters_value_check check (next_value > 0)
);

create table if not exists public.pos_operations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  session_id uuid not null,
  client_operation_id uuid not null,
  sequence integer not null,
  request_payload jsonb not null,
  sale_id uuid,
  status text not null default 'synced',
  result_payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null,
  synced_at timestamptz not null default now(),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint pos_operations_sequence_check check (sequence > 0),
  constraint pos_operations_status_check check (status in ('synced', 'incident', 'voided')),
  constraint pos_operations_company_operation_unique unique (empresa_id, client_operation_id),
  constraint pos_operations_session_sequence_unique unique (session_id, sequence),
  constraint pos_operations_session_empresa_fkey
    foreign key (session_id, empresa_id) references public.pos_sessions(id, empresa_id)
    on delete restrict,
  constraint pos_operations_sale_empresa_fkey
    foreign key (sale_id, empresa_id) references public.ventas(id, empresa_id)
    on delete restrict
);

create index if not exists pos_operations_company_created_idx
  on public.pos_operations (empresa_id, created_at desc);

create table if not exists public.pos_payments (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  session_id uuid not null,
  sale_id uuid not null,
  account_id uuid not null,
  method text not null,
  amount numeric(14, 2) not null,
  reference text,
  status text not null default 'confirmed',
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pos_payments_method_check check (method in ('cash', 'card', 'sinpe', 'other')),
  constraint pos_payments_amount_check check (amount > 0),
  constraint pos_payments_status_check check (status in ('pending', 'confirmed', 'reversed')),
  constraint pos_payments_session_empresa_fkey
    foreign key (session_id, empresa_id) references public.pos_sessions(id, empresa_id)
    on delete restrict,
  constraint pos_payments_sale_empresa_fkey
    foreign key (sale_id, empresa_id) references public.ventas(id, empresa_id)
    on delete restrict,
  constraint pos_payments_account_empresa_fkey
    foreign key (account_id, empresa_id) references public.payments_accounts(id, empresa_id)
    on delete restrict,
  constraint pos_payments_verified_by_empresa_fkey
    foreign key (verified_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (verified_by)
);

create index if not exists pos_payments_pending_idx
  on public.pos_payments (empresa_id, status, created_at desc);

create table if not exists public.pos_cash_movements (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null,
  session_id uuid not null,
  sale_id uuid,
  type text not null,
  amount numeric(14, 2) not null,
  reason text,
  reference text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint pos_cash_movements_type_check
    check (type in ('opening', 'sale', 'cash_in', 'cash_out', 'refund', 'closing')),
  constraint pos_cash_movements_amount_check check (amount >= 0),
  constraint pos_cash_movements_session_empresa_fkey
    foreign key (session_id, empresa_id) references public.pos_sessions(id, empresa_id)
    on delete restrict,
  constraint pos_cash_movements_sale_empresa_fkey
    foreign key (sale_id, empresa_id) references public.ventas(id, empresa_id)
    on delete restrict,
  constraint pos_cash_movements_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
    on delete restrict
);

create index if not exists pos_cash_movements_session_idx
  on public.pos_cash_movements (empresa_id, session_id, created_at);

drop trigger if exists set_pos_terminals_updated_at on public.pos_terminals;
create trigger set_pos_terminals_updated_at before update on public.pos_terminals
for each row execute function public.set_updated_at();

drop trigger if exists set_pos_sessions_updated_at on public.pos_sessions;
create trigger set_pos_sessions_updated_at before update on public.pos_sessions
for each row execute function public.set_updated_at();

alter table public.pos_terminals enable row level security;
alter table public.pos_sessions enable row level security;
alter table public.pos_session_catalog enable row level security;
alter table public.pos_stock_allocations enable row level security;
alter table public.pos_sale_counters enable row level security;
alter table public.pos_operations enable row level security;
alter table public.pos_payments enable row level security;
alter table public.pos_cash_movements enable row level security;

grant select on public.pos_terminals, public.pos_sessions, public.pos_session_catalog,
  public.pos_stock_allocations, public.pos_operations, public.pos_payments,
  public.pos_cash_movements to authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'pos_terminals', 'pos_sessions', 'pos_session_catalog', 'pos_stock_allocations',
    'pos_operations', 'pos_payments', 'pos_cash_movements'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_company_read', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (empresa_id = (select public.current_empresa_id()) and ((select public.current_user_has_permission(''sales.pos.use'')) or (select public.current_user_has_permission(''sales.pos.manage'')) or (select public.current_user_has_permission(''sales.cash.manage''))))',
      v_table || '_company_read',
      v_table
    );
  end loop;
end;
$$;

revoke all on public.pos_sale_counters from public, anon, authenticated;
grant select, insert, update, delete on public.pos_sale_counters to service_role;

create or replace function public.create_pos_terminal(
  p_code text,
  p_name text,
  p_warehouse_id uuid,
  p_branch_id uuid default null,
  p_offline_enabled boolean default true,
  p_idempotency_key text default null
)
returns table (terminal_id uuid, reused boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_request jsonb;
  v_receipt public.business_operation_receipts%rowtype;
  v_terminal_id uuid;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.pos.manage') then
    raise exception 'Permiso sales.pos.manage requerido.' using errcode = '42501';
  end if;
  if v_key is null or length(v_key) > 200
    or nullif(btrim(coalesce(p_code, '')), '') is null
    or nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Datos de terminal POS inválidos.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_warehouse_id and b.empresa_id = v_company_id and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  v_request := jsonb_build_object(
    'code', upper(btrim(p_code)), 'name', btrim(p_name),
    'warehouse_id', p_warehouse_id, 'branch_id', p_branch_id,
    'offline_enabled', coalesce(p_offline_enabled, true)
  );
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':pos.terminal:' || v_key, 0));
  select r.* into v_receipt from public.business_operation_receipts as r
  where r.empresa_id = v_company_id and r.scope = 'pos.terminal.create' and r.idempotency_key = v_key;
  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;
    return query select (v_receipt.result_payload->>'terminal_id')::uuid, true;
    return;
  end if;

  insert into public.pos_terminals (
    empresa_id, sucursal_id, warehouse_id, code, name, offline_enabled, created_by, updated_by
  ) values (
    v_company_id, p_branch_id, p_warehouse_id, upper(btrim(p_code)), btrim(p_name),
    coalesce(p_offline_enabled, true), v_user_id, v_user_id
  ) returning id into v_terminal_id;

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id, 'pos.terminal.create', v_key, v_request,
    jsonb_build_object('terminal_id', v_terminal_id), v_user_id
  );
  return query select v_terminal_id, false;
end;
$$;

create or replace function public.open_pos_session(
  p_terminal_id uuid,
  p_opening_cash numeric,
  p_idempotency_key text
)
returns table (
  session_id uuid,
  authorized_until timestamptz,
  catalog_items integer,
  allocated_items integer,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_terminal public.pos_terminals%rowtype;
  v_session_id uuid;
  v_until timestamptz;
  v_catalog_count integer;
  v_allocation_count integer;
  v_request jsonb;
  v_receipt public.business_operation_receipts%rowtype;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.pos.use') then
    raise exception 'Permiso sales.pos.use requerido.' using errcode = '42501';
  end if;
  if v_key is null or length(v_key) > 200 or coalesce(p_opening_cash, -1) < 0 then
    raise exception 'Datos de apertura inválidos.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object('terminal_id', p_terminal_id, 'opening_cash', round(p_opening_cash, 2));
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':pos.session.open:' || v_key, 0));
  select r.* into v_receipt from public.business_operation_receipts as r
  where r.empresa_id = v_company_id and r.scope = 'pos.session.open' and r.idempotency_key = v_key;
  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.' using errcode = '23505';
    end if;
    return query select
      (v_receipt.result_payload->>'session_id')::uuid,
      (v_receipt.result_payload->>'authorized_until')::timestamptz,
      (v_receipt.result_payload->>'catalog_items')::integer,
      (v_receipt.result_payload->>'allocated_items')::integer,
      true;
    return;
  end if;

  select t.* into v_terminal from public.pos_terminals as t
  where t.id = p_terminal_id and t.empresa_id = v_company_id
  for update;
  if v_terminal.id is null or v_terminal.status <> 'active' then
    raise exception 'Terminal POS no disponible.' using errcode = '02000';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':pos.stock.reserve:' || v_terminal.warehouse_id::text, 0)
  );
  if exists (
    select 1 from public.pos_sessions as s
    where s.empresa_id = v_company_id and s.terminal_id = p_terminal_id
      and s.status in ('open', 'pending_sync')
  ) then
    raise exception 'La terminal ya tiene una sesión abierta.' using errcode = '23505';
  end if;

  v_until := now() + make_interval(hours => v_terminal.offline_session_hours);
  insert into public.pos_sessions (
    empresa_id, terminal_id, opened_by, authorized_until, opening_cash
  ) values (
    v_company_id, p_terminal_id, v_user_id, v_until, round(p_opening_cash, 2)
  ) returning id into v_session_id;

  insert into public.pos_session_catalog (
    session_id, empresa_id, product_id, product_type, code, name, unit,
    currency, unit_price, tax_rate, source_updated_at
  )
  select v_session_id, v_company_id, p.id, p.tipo, p.codigo, p.nombre,
    p.unidad_medida, p.moneda, p.precio_base, p.impuesto_porcentaje, p.updated_at
  from public.catalogo_productos as p
  where p.empresa_id = v_company_id and p.estado = 'activo';
  get diagnostics v_catalog_count = row_count;

  if v_terminal.offline_enabled and v_terminal.offline_stock_fraction > 0 then
    insert into public.pos_stock_allocations (
      empresa_id, session_id, product_id, warehouse_id, allocated_quantity
    )
    select
      v_company_id,
      v_session_id,
      stock.producto_id,
      v_terminal.warehouse_id,
      round(
        least(
          v_terminal.offline_stock_cap,
          greatest(0::numeric, stock.cantidad - coalesce(reserved.quantity, 0))
            * v_terminal.offline_stock_fraction
        ),
        2
      )
    from public.inventario_stock as stock
    left join lateral (
      select sum(a.allocated_quantity - a.consumed_quantity) as quantity
      from public.pos_stock_allocations as a
      join public.pos_sessions as active_session
        on active_session.id = a.session_id and active_session.empresa_id = a.empresa_id
      where a.empresa_id = v_company_id
        and a.warehouse_id = v_terminal.warehouse_id
        and a.product_id = stock.producto_id
        and a.released_at is null
        and active_session.status in ('open', 'pending_sync')
    ) as reserved on true
    where stock.empresa_id = v_company_id
      and stock.bodega_id = v_terminal.warehouse_id
      and stock.cantidad > coalesce(reserved.quantity, 0)
    on conflict (empresa_id, session_id, product_id) do nothing;
    get diagnostics v_allocation_count = row_count;
  else
    v_allocation_count := 0;
  end if;

  insert into public.pos_cash_movements (
    empresa_id, session_id, type, amount, reason, created_by
  ) values (
    v_company_id, v_session_id, 'opening', round(p_opening_cash, 2), 'Fondo inicial', v_user_id
  );

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  ) values (
    v_company_id, 'pos.session.open', v_key, v_request,
    jsonb_build_object(
      'session_id', v_session_id,
      'authorized_until', v_until,
      'catalog_items', v_catalog_count,
      'allocated_items', v_allocation_count
    ),
    v_user_id
  );

  return query select v_session_id, v_until, v_catalog_count, v_allocation_count, false;
end;
$$;

create or replace function public.register_pos_sale(
  p_session_id uuid,
  p_client_operation_id uuid,
  p_sequence integer,
  p_items jsonb,
  p_payments jsonb,
  p_offline boolean default false,
  p_captured_at timestamptz default now()
)
returns table (
  sale_id uuid,
  sale_number text,
  total numeric,
  payment_status text,
  fiscal_status text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_session public.pos_sessions%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_existing public.pos_operations%rowtype;
  v_snapshot public.pos_session_catalog%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_allocation public.pos_stock_allocations%rowtype;
  v_item jsonb;
  v_payment jsonb;
  v_request jsonb;
  v_quantity numeric(14, 2);
  v_line_subtotal numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_payment_total numeric(14, 2) := 0;
  v_pending_total numeric(14, 2) := 0;
  v_payment_amount numeric(14, 2);
  v_payment_method text;
  v_payment_verified boolean;
  v_sale_id uuid;
  v_account_id uuid;
  v_number text;
  v_counter integer;
  v_year integer := extract(year from current_date)::integer;
  v_inventory_items integer := 0;
  v_other_reserved numeric(14, 2);
  v_own_remaining numeric(14, 2);
  v_payment_state text;
  v_fiscal_state text;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('sales.pos.use') then
    raise exception 'Permiso sales.pos.use requerido.' using errcode = '42501';
  end if;
  if p_client_operation_id is null or coalesce(p_sequence, 0) <= 0
    or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
    or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Operación POS inválida.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'session_id', p_session_id,
    'sequence', p_sequence,
    'items', p_items,
    'payments', p_payments,
    'offline', coalesce(p_offline, false),
    'captured_at', p_captured_at
  );
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':pos.sale:' || p_client_operation_id::text, 0));
  select o.* into v_existing from public.pos_operations as o
  where o.empresa_id = v_company_id and o.client_operation_id = p_client_operation_id;
  if found then
    if v_existing.request_payload <> v_request then
      raise exception 'La operación ya existe con contenido diferente.' using errcode = '23505';
    end if;
    return query select
      v_existing.sale_id,
      v_existing.result_payload->>'sale_number',
      (v_existing.result_payload->>'total')::numeric,
      v_existing.result_payload->>'payment_status',
      v_existing.result_payload->>'fiscal_status',
      true;
    return;
  end if;

  select s.* into v_session from public.pos_sessions as s
  where s.id = p_session_id and s.empresa_id = v_company_id
  for update;
  if v_session.id is null or v_session.status <> 'open' then
    raise exception 'Sesión POS no disponible.' using errcode = '02000';
  end if;
  select t.* into v_terminal from public.pos_terminals as t
  where t.id = v_session.terminal_id and t.empresa_id = v_company_id;
  if v_terminal.status <> 'active' then
    raise exception 'Terminal POS no disponible.' using errcode = '22023';
  end if;
  if p_offline and (
    not v_terminal.offline_enabled
    or p_captured_at < v_session.opened_at
    or p_captured_at > v_session.authorized_until
    or p_captured_at > now() + interval '5 minutes'
  ) then
    raise exception 'La autorización de venta sin conexión no es válida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.pos_operations as o
    where o.session_id = p_session_id and o.sequence = p_sequence
  ) then
    raise exception 'La secuencia de terminal ya fue utilizada.' using errcode = '23505';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_quantity := round((v_item->>'quantity')::numeric, 2);
    exception when others then
      raise exception 'Cantidad POS inválida.' using errcode = '22023';
    end;
    if v_quantity <= 0 or nullif(v_item->>'product_id', '') is null then
      raise exception 'Producto o cantidad POS inválidos.' using errcode = '22023';
    end if;
    select c.* into v_snapshot from public.pos_session_catalog as c
    where c.session_id = p_session_id and c.empresa_id = v_company_id
      and c.product_id = (v_item->>'product_id')::uuid;
    if v_snapshot.product_id is null then
      raise exception 'Producto fuera del catálogo autorizado para la sesión.' using errcode = '22023';
    end if;
    v_line_subtotal := round(v_quantity * v_snapshot.unit_price, 2);
    v_line_tax := round(v_line_subtotal * v_snapshot.tax_rate / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax;
    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax := v_tax + v_line_tax;
    v_total := v_total + v_line_total;
  end loop;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    begin
      v_payment_amount := round((v_payment->>'amount')::numeric, 2);
    exception when others then
      raise exception 'Monto de pago inválido.' using errcode = '22023';
    end;
    v_payment_method := lower(coalesce(v_payment->>'method', ''));
    v_payment_verified := coalesce((v_payment->>'verified')::boolean, v_payment_method <> 'sinpe');
    if v_payment_amount <= 0 or v_payment_method not in ('cash', 'card', 'sinpe', 'other') then
      raise exception 'Pago POS inválido.' using errcode = '22023';
    end if;
    if not v_payment_verified and v_payment_method <> 'sinpe' then
      raise exception 'Solo SINPE puede quedar pendiente de verificación.' using errcode = '22023';
    end if;
    v_payment_total := v_payment_total + v_payment_amount;
    if not v_payment_verified then v_pending_total := v_pending_total + v_payment_amount; end if;
  end loop;
  if v_payment_total <> v_total then
    raise exception 'Los pagos deben coincidir exactamente con el total de la venta.' using errcode = '22023';
  end if;

  insert into public.pos_sale_counters (empresa_id, sale_year, next_value)
  values (v_company_id, v_year, 2)
  on conflict (empresa_id, sale_year) do update
  set next_value = public.pos_sale_counters.next_value + 1
  returning next_value - 1 into v_counter;
  v_number := 'POS-' || v_year::text || '-' || lpad(v_counter::text, 7, '0');
  v_sale_id := gen_random_uuid();
  v_payment_state := case when v_pending_total = 0 then 'pagado' when v_pending_total = v_total then 'pendiente' else 'parcial' end;
  v_fiscal_state := case when exists (
    select 1 from public.company_fiscal_connections as c
    where c.empresa_id = v_company_id and c.status = 'active'
  ) then 'pendiente' else 'no_solicitado' end;

  insert into public.ventas (
    id, empresa_id, cliente_id, numero, estado, fecha_venta, moneda,
    subtotal, descuento_total, impuesto_total, total, notas,
    creado_por, actualizado_por, origen, cobro_estado, entrega_estado,
    fiscal_estado, inventario_estado, inventario_aplicado_at, inventario_aplicado_por
  ) values (
    v_sale_id, v_company_id, null, v_number, 'completada', p_captured_at::date, 'CRC',
    v_subtotal, 0, v_tax, v_total, 'Venta de punto de venta',
    v_user_id, v_user_id, 'pos', v_payment_state, 'entregado',
    v_fiscal_state, 'pendiente', null, null
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := round((v_item->>'quantity')::numeric, 2);
    select c.* into v_snapshot from public.pos_session_catalog as c
    where c.session_id = p_session_id and c.empresa_id = v_company_id
      and c.product_id = (v_item->>'product_id')::uuid;
    v_line_subtotal := round(v_quantity * v_snapshot.unit_price, 2);
    v_line_tax := round(v_line_subtotal * v_snapshot.tax_rate / 100, 2);
    v_line_total := v_line_subtotal + v_line_tax;
    insert into public.venta_items (
      empresa_id, venta_id, producto_id, descripcion, cantidad, precio_unitario,
      descuento, impuesto_porcentaje, subtotal, impuesto_monto, total, orden
    ) values (
      v_company_id, v_sale_id, v_snapshot.product_id, v_snapshot.name, v_quantity,
      v_snapshot.unit_price, 0, v_snapshot.tax_rate, v_line_subtotal, v_line_tax,
      v_line_total, v_inventory_items
    );

    if v_snapshot.product_type = 'producto' then
      v_inventory_items := v_inventory_items + 1;
      insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
      values (v_company_id, v_snapshot.product_id, v_terminal.warehouse_id, 0)
      on conflict on constraint inventario_stock_empresa_producto_bodega_unique do nothing;
      select stock.* into v_stock from public.inventario_stock as stock
      where stock.empresa_id = v_company_id and stock.producto_id = v_snapshot.product_id
        and stock.bodega_id = v_terminal.warehouse_id
      for update;
      select allocation.* into v_allocation from public.pos_stock_allocations as allocation
      where allocation.empresa_id = v_company_id and allocation.session_id = p_session_id
        and allocation.product_id = v_snapshot.product_id
      for update;
      v_own_remaining := case when v_allocation.id is null then 0 else v_allocation.allocated_quantity - v_allocation.consumed_quantity end;
      select coalesce(sum(a.allocated_quantity - a.consumed_quantity), 0)
      into v_other_reserved
      from public.pos_stock_allocations as a
      join public.pos_sessions as active_session
        on active_session.id = a.session_id and active_session.empresa_id = a.empresa_id
      where a.empresa_id = v_company_id and a.warehouse_id = v_terminal.warehouse_id
        and a.product_id = v_snapshot.product_id and a.session_id <> p_session_id
        and a.released_at is null and active_session.status in ('open', 'pending_sync');
      if p_offline and v_own_remaining < v_quantity then
        raise exception 'Cupo sin conexión insuficiente para %.', v_snapshot.name using errcode = '22023';
      end if;
      if v_stock.cantidad - v_other_reserved < v_quantity then
        raise exception 'Stock disponible insuficiente para %.', v_snapshot.name using errcode = '22023';
      end if;
      if v_allocation.id is not null then
        update public.pos_stock_allocations
        set consumed_quantity = consumed_quantity + least(v_quantity, v_own_remaining)
        where id = v_allocation.id;
      end if;
      update public.inventario_stock set cantidad = cantidad - v_quantity where id = v_stock.id;
      insert into public.inventario_movimientos (
        empresa_id, producto_id, bodega_id, tipo, cantidad, cantidad_anterior,
        cantidad_nueva, motivo, referencia_tipo, referencia_id, created_by
      ) values (
        v_company_id, v_snapshot.product_id, v_terminal.warehouse_id, 'salida',
        v_quantity, v_stock.cantidad, v_stock.cantidad - v_quantity,
        'Salida por venta POS ' || v_number, 'venta', v_sale_id, v_user_id
      );
    end if;
  end loop;

  update public.ventas set
    inventario_estado = case when v_inventory_items > 0 then 'aplicado' else 'no_aplica' end,
    inventario_aplicado_at = case when v_inventory_items > 0 then now() else null end,
    inventario_aplicado_por = case when v_inventory_items > 0 then v_user_id else null end
  where id = v_sale_id and empresa_id = v_company_id;

  insert into public.payments_accounts (
    empresa_id, tipo, venta_id, numero, descripcion, moneda, total, saldo,
    fecha_emision, estado, created_by, updated_by
  ) values (
    v_company_id, 'receivable', v_sale_id, 'CXC-' || v_number,
    'Cobro venta POS ' || v_number, 'CRC', v_total, v_pending_total,
    p_captured_at::date,
    case when v_pending_total = 0 then 'pagada' when v_pending_total = v_total then 'pendiente' else 'parcial' end,
    v_user_id, v_user_id
  ) returning id into v_account_id;

  for v_payment in select value from jsonb_array_elements(p_payments)
  loop
    v_payment_amount := round((v_payment->>'amount')::numeric, 2);
    v_payment_method := lower(v_payment->>'method');
    v_payment_verified := coalesce((v_payment->>'verified')::boolean, v_payment_method <> 'sinpe');
    insert into public.pos_payments (
      empresa_id, session_id, sale_id, account_id, method, amount, reference,
      status, verified_by, verified_at
    ) values (
      v_company_id, p_session_id, v_sale_id, v_account_id, v_payment_method,
      v_payment_amount, nullif(btrim(coalesce(v_payment->>'reference', '')), ''),
      case when v_payment_verified then 'confirmed' else 'pending' end,
      case when v_payment_verified then v_user_id else null end,
      case when v_payment_verified then now() else null end
    );
    if v_payment_verified then
      insert into public.payments_transactions (
        empresa_id, account_id, tipo, monto, metodo, referencia, notas, paid_at, created_by
      ) values (
        v_company_id, v_account_id, 'payment', v_payment_amount, v_payment_method,
        nullif(btrim(coalesce(v_payment->>'reference', '')), ''),
        'Pago de venta POS ' || v_number, p_captured_at, v_user_id
      );
    end if;
    if v_payment_verified and v_payment_method = 'cash' then
      insert into public.pos_cash_movements (
        empresa_id, session_id, sale_id, type, amount, reason, reference, created_by
      ) values (
        v_company_id, p_session_id, v_sale_id, 'sale', v_payment_amount,
        'Venta POS ' || v_number, nullif(btrim(coalesce(v_payment->>'reference', '')), ''), v_user_id
      );
    end if;
  end loop;

  if v_fiscal_state = 'pendiente' then
    insert into public.integration_outbox (
      empresa_id, topic, idempotency_key, aggregate_type, aggregate_id, payload, created_by
    ) values (
      v_company_id, 'fiscal.issue', 'pos-sale:' || v_sale_id::text, 'ventas', v_sale_id,
      jsonb_build_object('sale_id', v_sale_id, 'source', 'pos'), v_user_id
    ) on conflict (empresa_id, topic, idempotency_key) do nothing;
  end if;

  insert into public.pos_operations (
    empresa_id, session_id, client_operation_id, sequence, request_payload,
    sale_id, result_payload, captured_at
  ) values (
    v_company_id, p_session_id, p_client_operation_id, p_sequence, v_request,
    v_sale_id,
    jsonb_build_object(
      'sale_number', v_number, 'total', v_total,
      'payment_status', v_payment_state, 'fiscal_status', v_fiscal_state
    ),
    p_captured_at
  );
  update public.pos_sessions set last_sequence = greatest(last_sequence, p_sequence)
  where id = p_session_id and empresa_id = v_company_id;
  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_company_id, v_user_id, 'ventas', v_sale_id, 'registrar_venta_pos',
    jsonb_build_object(
      'numero', v_number, 'total', v_total, 'cobro_estado', v_payment_state,
      'fiscal_estado', v_fiscal_state, 'offline', p_offline,
      'client_operation_id', p_client_operation_id, 'sequence', p_sequence
    )
  );
  return query select v_sale_id, v_number, v_total, v_payment_state, v_fiscal_state, false;
end;
$$;

create or replace function public.verify_pos_payment(p_payment_id uuid)
returns table (payment_id uuid, sale_id uuid, payment_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_payment public.pos_payments%rowtype;
  v_account public.payments_accounts%rowtype;
  v_new_balance numeric(14, 2);
  v_sale_state text;
begin
  if v_user_id is null or v_company_id is null then raise exception 'Usuario autenticado requerido.' using errcode = '28000'; end if;
  if not public.current_user_has_permission('sales.cash.manage') then
    raise exception 'Permiso sales.cash.manage requerido.' using errcode = '42501';
  end if;
  select p.* into v_payment from public.pos_payments as p
  where p.id = p_payment_id and p.empresa_id = v_company_id for update;
  if v_payment.id is null then raise exception 'Pago POS no encontrado.' using errcode = '02000'; end if;
  if v_payment.status = 'confirmed' then
    select v.cobro_estado into v_sale_state from public.ventas as v where v.id = v_payment.sale_id;
    return query select v_payment.id, v_payment.sale_id, v_sale_state;
    return;
  end if;
  if v_payment.status <> 'pending' then raise exception 'El pago no puede verificarse.' using errcode = '22023'; end if;
  select a.* into v_account from public.payments_accounts as a
  where a.id = v_payment.account_id and a.empresa_id = v_company_id for update;
  if v_payment.amount > v_account.saldo then raise exception 'El pago supera el saldo pendiente.' using errcode = '22023'; end if;
  v_new_balance := v_account.saldo - v_payment.amount;
  update public.pos_payments set status = 'confirmed', verified_by = v_user_id, verified_at = now()
  where id = v_payment.id;
  insert into public.payments_transactions (
    empresa_id, account_id, tipo, monto, metodo, referencia, notas, created_by
  ) values (
    v_company_id, v_payment.account_id, 'payment', v_payment.amount, v_payment.method,
    v_payment.reference, 'Verificación de pago POS', v_user_id
  );
  update public.payments_accounts set saldo = v_new_balance,
    estado = case when v_new_balance = 0 then 'pagada' else 'parcial' end,
    updated_by = v_user_id
  where id = v_account.id;
  v_sale_state := case when v_new_balance = 0 then 'pagado' else 'parcial' end;
  update public.ventas set cobro_estado = v_sale_state, actualizado_por = v_user_id
  where id = v_payment.sale_id and empresa_id = v_company_id;
  return query select v_payment.id, v_payment.sale_id, v_sale_state;
end;
$$;

create or replace function public.close_pos_session(
  p_session_id uuid,
  p_last_sequence integer,
  p_counted_cash numeric
)
returns table (session_id uuid, expected_cash numeric, counted_cash numeric, cash_difference numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_session public.pos_sessions%rowtype;
  v_operation_count integer;
  v_operation_max integer;
  v_expected numeric(14, 2);
  v_difference numeric(14, 2);
begin
  if v_user_id is null or v_company_id is null then raise exception 'Usuario autenticado requerido.' using errcode = '28000'; end if;
  if not public.current_user_has_permission('sales.cash.manage')
    and not public.current_user_has_permission('sales.pos.manage') then
    raise exception 'Permiso de cierre de caja requerido.' using errcode = '42501';
  end if;
  if coalesce(p_last_sequence, -1) < 0 or coalesce(p_counted_cash, -1) < 0 then
    raise exception 'Datos de cierre inválidos.' using errcode = '22023';
  end if;
  select s.* into v_session from public.pos_sessions as s
  where s.id = p_session_id and s.empresa_id = v_company_id for update;
  if v_session.id is null or v_session.status not in ('open', 'pending_sync') then
    raise exception 'Sesión POS no disponible para cierre.' using errcode = '22023';
  end if;
  select count(*), coalesce(max(o.sequence), 0) into v_operation_count, v_operation_max
  from public.pos_operations as o where o.session_id = p_session_id and o.empresa_id = v_company_id;
  if v_operation_count <> p_last_sequence or v_operation_max <> p_last_sequence then
    raise exception 'La caja conserva ventas pendientes de sincronización.' using errcode = '22023';
  end if;
  select round(sum(case
    when m.type in ('opening', 'sale', 'cash_in') then m.amount
    when m.type in ('cash_out', 'refund') then -m.amount
    else 0 end), 2)
  into v_expected
  from public.pos_cash_movements as m
  where m.session_id = p_session_id and m.empresa_id = v_company_id;
  v_expected := coalesce(v_expected, 0);
  v_difference := round(p_counted_cash - v_expected, 2);
  insert into public.pos_cash_movements (
    empresa_id, session_id, type, amount, reason, created_by
  ) values (
    v_company_id, p_session_id, 'closing', round(p_counted_cash, 2), 'Arqueo de cierre', v_user_id
  );
  update public.pos_sessions set status = 'closed', closed_by = v_user_id, closed_at = now(),
    expected_cash = v_expected, counted_cash = round(p_counted_cash, 2),
    cash_difference = v_difference
  where id = p_session_id;
  update public.pos_stock_allocations set released_at = now()
  where session_id = p_session_id and empresa_id = v_company_id and released_at is null;
  return query select p_session_id, v_expected, round(p_counted_cash, 2), v_difference;
end;
$$;

revoke all on function public.create_pos_terminal(text, text, uuid, uuid, boolean, text) from public, anon;
revoke all on function public.open_pos_session(uuid, numeric, text) from public, anon;
revoke all on function public.register_pos_sale(uuid, uuid, integer, jsonb, jsonb, boolean, timestamptz) from public, anon;
revoke all on function public.verify_pos_payment(uuid) from public, anon;
revoke all on function public.close_pos_session(uuid, integer, numeric) from public, anon;
grant execute on function public.create_pos_terminal(text, text, uuid, uuid, boolean, text) to authenticated;
grant execute on function public.open_pos_session(uuid, numeric, text) to authenticated;
grant execute on function public.register_pos_sale(uuid, uuid, integer, jsonb, jsonb, boolean, timestamptz) to authenticated;
grant execute on function public.verify_pos_payment(uuid) to authenticated;
grant execute on function public.close_pos_session(uuid, integer, numeric) to authenticated;
