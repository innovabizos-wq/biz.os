-- Operational module contracts for payments, purchases, AI, mobile and reports.
-- This migration is additive and preserves all existing business data.

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('purchases.suppliers.view', 'Ver proveedores', 'Permite consultar proveedores.', 'purchases', 'activo'),
  ('purchases.suppliers.manage', 'Gestionar proveedores', 'Permite crear y editar proveedores.', 'purchases', 'activo'),
  ('purchases.orders.view', 'Ver ordenes de compra', 'Permite consultar ordenes de compra.', 'purchases', 'activo'),
  ('purchases.orders.manage', 'Gestionar ordenes de compra', 'Permite crear, editar y recibir ordenes de compra.', 'purchases', 'activo'),
  ('payments.accounts.view', 'Ver cuentas y pagos', 'Permite consultar cuentas por cobrar, cuentas por pagar y pagos.', 'payments', 'activo'),
  ('payments.accounts.manage', 'Gestionar cuentas y pagos', 'Permite registrar pagos, abonos y ajustes.', 'payments', 'activo'),
  ('reports.dashboard.view', 'Ver reportes', 'Permite consultar dashboard y reportes operativos.', 'reports', 'activo'),
  ('ai.reports.use', 'Usar IA operativa', 'Permite usar analisis y asistencia IA sobre contexto del negocio.', 'ai', 'activo'),
  ('mobile.access', 'Acceso app movil', 'Permite usar contratos de API movil habilitados para la empresa.', 'mobile', 'activo')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'purchases.suppliers.view',
    'purchases.suppliers.manage',
    'purchases.orders.view',
    'purchases.orders.manage',
    'payments.accounts.view',
    'payments.accounts.manage',
    'reports.dashboard.view',
    'ai.reports.use',
    'mobile.access'
  )
where r.es_sistema = true
  and r.nombre in ('Administrador', 'Super Admin')
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

create table if not exists public.payments_accounts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo text not null default 'receivable',
  venta_id uuid,
  compra_id uuid,
  cliente_id uuid,
  proveedor_id uuid,
  numero text not null,
  descripcion text,
  moneda text not null default 'CRC',
  total numeric(14, 2) not null default 0,
  saldo numeric(14, 2) not null default 0,
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  estado text not null default 'pendiente',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_accounts_tipo_check check (tipo in ('receivable', 'payable')),
  constraint payments_accounts_estado_check check (estado in ('pendiente', 'parcial', 'pagada', 'vencida', 'anulada')),
  constraint payments_accounts_total_check check (total >= 0),
  constraint payments_accounts_saldo_check check (saldo >= 0),
  constraint payments_accounts_empresa_numero_unique unique (empresa_id, numero),
  constraint payments_accounts_id_empresa_unique unique (id, empresa_id),
  constraint payments_accounts_venta_empresa_fkey
    foreign key (venta_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete set null (venta_id),
  constraint payments_accounts_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete set null (cliente_id),
  constraint payments_accounts_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint payments_accounts_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create unique index if not exists payments_accounts_empresa_venta_unique
  on public.payments_accounts (empresa_id, venta_id)
  where venta_id is not null and tipo = 'receivable';
create index if not exists payments_accounts_empresa_tipo_estado_idx
  on public.payments_accounts (empresa_id, tipo, estado);
create index if not exists payments_accounts_empresa_due_idx
  on public.payments_accounts (empresa_id, fecha_vencimiento);
create index if not exists payments_accounts_empresa_cliente_idx
  on public.payments_accounts (empresa_id, cliente_id);

drop trigger if exists set_payments_accounts_updated_at on public.payments_accounts;
create trigger set_payments_accounts_updated_at
before update on public.payments_accounts
for each row execute function public.set_updated_at();

create table if not exists public.payments_transactions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  account_id uuid not null,
  tipo text not null default 'payment',
  monto numeric(14, 2) not null,
  metodo text not null default 'manual',
  referencia text,
  notas text,
  paid_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint payments_transactions_tipo_check check (tipo in ('payment', 'adjustment')),
  constraint payments_transactions_monto_check check (monto > 0),
  constraint payments_transactions_account_empresa_fkey
    foreign key (account_id, empresa_id)
    references public.payments_accounts(id, empresa_id)
    on delete cascade,
  constraint payments_transactions_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index if not exists payments_transactions_empresa_account_idx
  on public.payments_transactions (empresa_id, account_id);
create index if not exists payments_transactions_empresa_paid_at_idx
  on public.payments_transactions (empresa_id, paid_at desc);

create table if not exists public.purchases_suppliers (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nombre text not null,
  identificacion text,
  correo text,
  telefono text,
  direccion text,
  estado text not null default 'activo',
  notas text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchases_suppliers_estado_check check (estado in ('activo', 'inactivo')),
  constraint purchases_suppliers_empresa_nombre_unique unique (empresa_id, nombre),
  constraint purchases_suppliers_id_empresa_unique unique (id, empresa_id),
  constraint purchases_suppliers_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint purchases_suppliers_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index if not exists purchases_suppliers_empresa_estado_idx
  on public.purchases_suppliers (empresa_id, estado);
drop trigger if exists set_purchases_suppliers_updated_at on public.purchases_suppliers;
create trigger set_purchases_suppliers_updated_at
before update on public.purchases_suppliers
for each row execute function public.set_updated_at();

create table if not exists public.purchases_orders (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  supplier_id uuid,
  numero text not null,
  estado text not null default 'borrador',
  moneda text not null default 'CRC',
  subtotal numeric(14, 2) not null default 0,
  impuesto_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  fecha_orden date not null default current_date,
  fecha_recepcion date,
  bodega_id uuid,
  notas text,
  received_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchases_orders_estado_check check (estado in ('borrador', 'emitida', 'recibida', 'cancelada')),
  constraint purchases_orders_total_check check (total >= 0),
  constraint purchases_orders_empresa_numero_unique unique (empresa_id, numero),
  constraint purchases_orders_id_empresa_unique unique (id, empresa_id),
  constraint purchases_orders_supplier_empresa_fkey
    foreign key (supplier_id, empresa_id)
    references public.purchases_suppliers(id, empresa_id)
    on delete set null (supplier_id),
  constraint purchases_orders_bodega_empresa_fkey
    foreign key (bodega_id, empresa_id)
    references public.inventario_bodegas(id, empresa_id)
    on delete set null (bodega_id),
  constraint purchases_orders_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint purchases_orders_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index if not exists purchases_orders_empresa_estado_idx
  on public.purchases_orders (empresa_id, estado);
create index if not exists purchases_orders_empresa_supplier_idx
  on public.purchases_orders (empresa_id, supplier_id);
drop trigger if exists set_purchases_orders_updated_at on public.purchases_orders;
create trigger set_purchases_orders_updated_at
before update on public.purchases_orders
for each row execute function public.set_updated_at();

create table if not exists public.purchases_order_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  order_id uuid not null,
  producto_id uuid,
  descripcion text not null,
  cantidad numeric(14, 2) not null default 1,
  costo_unitario numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(5, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  impuesto_monto numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint purchases_order_items_order_empresa_fkey
    foreign key (order_id, empresa_id)
    references public.purchases_orders(id, empresa_id)
    on delete cascade,
  constraint purchases_order_items_producto_empresa_fkey
    foreign key (producto_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete set null (producto_id),
  constraint purchases_order_items_cantidad_check check (cantidad > 0),
  constraint purchases_order_items_costo_check check (costo_unitario >= 0)
);

create index if not exists purchases_order_items_empresa_order_idx
  on public.purchases_order_items (empresa_id, order_id);
create index if not exists purchases_order_items_empresa_producto_idx
  on public.purchases_order_items (empresa_id, producto_id);

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid,
  provider text,
  feature text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  status text not null default 'logged',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint ai_usage_events_status_check check (status in ('logged', 'blocked', 'error')),
  constraint ai_usage_events_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (profile_id)
);

create index if not exists ai_usage_events_empresa_created_idx
  on public.ai_usage_events (empresa_id, created_at desc);
create index if not exists ai_usage_events_empresa_feature_idx
  on public.ai_usage_events (empresa_id, feature);

alter table public.payments_accounts enable row level security;
alter table public.payments_transactions enable row level security;
alter table public.purchases_suppliers enable row level security;
alter table public.purchases_orders enable row level security;
alter table public.purchases_order_items enable row level security;
alter table public.ai_usage_events enable row level security;

grant select on public.payments_accounts to authenticated;
grant select on public.payments_transactions to authenticated;
grant select on public.purchases_suppliers to authenticated;
grant select on public.purchases_orders to authenticated;
grant select on public.purchases_order_items to authenticated;
grant select on public.ai_usage_events to authenticated;

drop policy if exists payments_accounts_select_permission on public.payments_accounts;
create policy payments_accounts_select_permission
on public.payments_accounts
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('payments.accounts.view'))
);

drop policy if exists payments_transactions_select_permission on public.payments_transactions;
create policy payments_transactions_select_permission
on public.payments_transactions
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('payments.accounts.view'))
);

drop policy if exists purchases_suppliers_select_permission on public.purchases_suppliers;
create policy purchases_suppliers_select_permission
on public.purchases_suppliers
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.suppliers.view'))
    or (select public.current_user_has_permission('purchases.suppliers.manage'))
  )
);

drop policy if exists purchases_orders_select_permission on public.purchases_orders;
create policy purchases_orders_select_permission
on public.purchases_orders
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

drop policy if exists purchases_order_items_select_permission on public.purchases_order_items;
create policy purchases_order_items_select_permission
on public.purchases_order_items
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('purchases.orders.view'))
    or (select public.current_user_has_permission('purchases.orders.manage'))
  )
);

drop policy if exists ai_usage_events_select_permission on public.ai_usage_events;
create policy ai_usage_events_select_permission
on public.ai_usage_events
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('ai.reports.use'))
);

create or replace function public.sincronizar_cuentas_cobrar_ventas_actual()
returns table (
  account_id uuid,
  venta_id uuid,
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

  insert into public.payments_accounts (
    empresa_id,
    tipo,
    venta_id,
    cliente_id,
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
  select
    v.empresa_id,
    'receivable',
    v.id,
    v.cliente_id,
    'CXC-' || v.numero,
    'Cuenta por cobrar de venta ' || v.numero,
    v.moneda,
    v.total,
    greatest(v.total - coalesce(paid.total_pagado, 0), 0),
    v.fecha_venta,
    v.fecha_venta + interval '30 days',
    case
      when greatest(v.total - coalesce(paid.total_pagado, 0), 0) = 0 then 'pagada'
      when coalesce(paid.total_pagado, 0) > 0 then 'parcial'
      when v.fecha_venta + interval '30 days' < current_date then 'vencida'
      else 'pendiente'
    end,
    v_user_id,
    v_user_id
  from public.ventas as v
  left join public.payments_accounts as existing
    on existing.empresa_id = v.empresa_id
   and existing.venta_id = v.id
   and existing.tipo = 'receivable'
  left join lateral (
    select sum(t.monto) as total_pagado
    from public.payments_transactions as t
    join public.payments_accounts as a
      on a.id = t.account_id
     and a.empresa_id = t.empresa_id
    where a.empresa_id = v.empresa_id
      and a.venta_id = v.id
      and a.tipo = 'receivable'
  ) as paid on true
  where v.empresa_id = v_empresa_id
    and v.estado <> 'cancelada'
    and existing.id is null;

  with paid as (
    select
      a.id,
      coalesce(sum(t.monto), 0) as total_pagado
    from public.payments_accounts as a
    left join public.payments_transactions as t
      on t.empresa_id = a.empresa_id
     and t.account_id = a.id
    where a.empresa_id = v_empresa_id
      and a.tipo = 'receivable'
      and a.estado <> 'anulada'
    group by a.id
  )
  update public.payments_accounts as a
  set
    saldo = greatest(a.total - paid.total_pagado, 0),
    estado = case
      when greatest(a.total - paid.total_pagado, 0) = 0 then 'pagada'
      when paid.total_pagado > 0 then 'parcial'
      when a.fecha_vencimiento is not null and a.fecha_vencimiento < current_date then 'vencida'
      else 'pendiente'
    end,
    updated_by = v_user_id
  from paid
  where a.id = paid.id
    and a.empresa_id = v_empresa_id;

  return query
  select
    a.id,
    a.venta_id,
    a.numero,
    a.total,
    a.saldo,
    a.estado
  from public.payments_accounts as a
  where a.empresa_id = v_empresa_id
    and a.tipo = 'receivable'
  order by a.created_at desc;
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
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_account public.payments_accounts%rowtype;
  v_new_saldo numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permiso payments.accounts.manage requerido.' using errcode = '42501';
  end if;

  if coalesce(p_monto, 0) <= 0 then
    raise exception 'Monto de pago requerido.' using errcode = '22023';
  end if;

  select * into v_account
  from public.payments_accounts
  where id = p_account_id
    and empresa_id = v_empresa_id
    and tipo = 'receivable'
  for update;

  if v_account.id is null then
    raise exception 'Cuenta por cobrar no encontrada.' using errcode = '02000';
  end if;

  if v_account.estado in ('pagada', 'anulada') then
    raise exception 'La cuenta no acepta nuevos pagos.' using errcode = '22023';
  end if;

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
    least(p_monto, v_account.saldo),
    coalesce(nullif(btrim(p_metodo), ''), 'manual'),
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id
  );

  v_new_saldo := greatest(v_account.saldo - least(p_monto, v_account.saldo), 0);

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

create or replace function public.crear_proveedor(
  p_nombre text,
  p_identificacion text default null,
  p_correo text default null,
  p_telefono text default null,
  p_direccion text default null,
  p_notas text default null
)
returns table (supplier_id uuid, nombre text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_supplier public.purchases_suppliers%rowtype;
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.suppliers.manage') then
    raise exception 'Permiso purchases.suppliers.manage requerido.' using errcode = '42501';
  end if;

  if v_nombre is null then
    raise exception 'Nombre de proveedor requerido.' using errcode = '22023';
  end if;

  insert into public.purchases_suppliers (
    empresa_id,
    nombre,
    identificacion,
    correo,
    telefono,
    direccion,
    notas,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    v_nombre,
    nullif(btrim(coalesce(p_identificacion, '')), ''),
    nullif(btrim(coalesce(p_correo, '')), ''),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    nullif(btrim(coalesce(p_direccion, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_supplier;

  return query select v_supplier.id, v_supplier.nombre, v_supplier.estado;
end;
$$;

create or replace function public.crear_orden_compra_basica(
  p_supplier_id uuid,
  p_producto_id uuid,
  p_bodega_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_costo_unitario numeric,
  p_impuesto_porcentaje numeric default 0,
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
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage') then
    raise exception 'Permiso purchases.orders.manage requerido.' using errcode = '42501';
  end if;

  if p_supplier_id is null or p_producto_id is null or p_bodega_id is null then
    raise exception 'Proveedor, producto y bodega son requeridos.' using errcode = '22023';
  end if;

  if coalesce(p_cantidad, 0) <= 0 or coalesce(p_costo_unitario, 0) < 0 then
    raise exception 'Cantidad y costo invalidos.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.purchases_suppliers where id = p_supplier_id and empresa_id = v_empresa_id and estado = 'activo') then
    raise exception 'Proveedor no disponible.' using errcode = '02000';
  end if;

  if not exists (select 1 from public.catalogo_productos where id = p_producto_id and empresa_id = v_empresa_id and tipo = 'producto' and estado = 'activo') then
    raise exception 'Producto no disponible.' using errcode = '02000';
  end if;

  if not exists (select 1 from public.inventario_bodegas where id = p_bodega_id and empresa_id = v_empresa_id and estado = 'activa') then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.purchases_orders
  where empresa_id = v_empresa_id
    and date_part('year', created_at) = date_part('year', now());

  v_numero := 'OC-' || to_char(current_date, 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
  v_subtotal := round(p_cantidad * p_costo_unitario, 2);
  v_tax := round(v_subtotal * coalesce(p_impuesto_porcentaje, 0) / 100, 2);
  v_total := v_subtotal + v_tax;

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
    'emitida',
    'CRC',
    v_subtotal,
    v_tax,
    v_total,
    p_bodega_id,
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_order;

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
    p_producto_id,
    coalesce(nullif(btrim(p_descripcion), ''), 'Producto de compra'),
    p_cantidad,
    p_costo_unitario,
    coalesce(p_impuesto_porcentaje, 0),
    v_subtotal,
    v_tax,
    v_total,
    1
  );

  return query select v_order.id, v_order.numero, v_order.estado, v_order.total;
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
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_order public.purchases_orders%rowtype;
  v_item public.purchases_order_items%rowtype;
  v_stock public.inventario_stock%rowtype;
  v_anterior numeric(14, 2);
  v_nueva numeric(14, 2);
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

  select * into v_order
  from public.purchases_orders
  where id = p_order_id
    and empresa_id = v_empresa_id
  for update;

  if v_order.id is null then
    raise exception 'Orden de compra no encontrada.' using errcode = '02000';
  end if;

  if v_order.estado <> 'emitida' then
    raise exception 'Solo se pueden recibir ordenes emitidas.' using errcode = '22023';
  end if;

  if v_order.bodega_id is null then
    raise exception 'La orden no tiene bodega de recepcion.' using errcode = '22023';
  end if;

  for v_item in
    select *
    from public.purchases_order_items
    where empresa_id = v_empresa_id
      and order_id = p_order_id
      and producto_id is not null
    order by orden asc, created_at asc
  loop
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
    v_nueva := v_stock.cantidad + v_item.cantidad;

    update public.inventario_stock
    set cantidad = v_nueva
    where id = v_stock.id
      and empresa_id = v_empresa_id;

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
      v_item.cantidad,
      v_anterior,
      v_nueva,
      'Recepcion de orden de compra ' || v_order.numero,
      'purchase_order',
      v_order.id,
      v_user_id
    );
  end loop;

  update public.purchases_orders
  set
    estado = 'recibida',
    fecha_recepcion = current_date,
    received_at = now(),
    updated_by = v_user_id
  where id = p_order_id
    and empresa_id = v_empresa_id
  returning * into v_order;

  return query select v_order.id, v_order.estado, v_order.received_at;
end;
$$;

create or replace function public.registrar_ai_usage_event(
  p_feature text,
  p_provider text default null,
  p_status text default 'logged',
  p_metadata jsonb default '{}'::jsonb,
  p_prompt_tokens integer default 0,
  p_completion_tokens integer default 0
)
returns table (event_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_event public.ai_usage_events%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('ai.reports.use') then
    raise exception 'Permiso ai.reports.use requerido.' using errcode = '42501';
  end if;

  insert into public.ai_usage_events (
    empresa_id,
    profile_id,
    provider,
    feature,
    prompt_tokens,
    completion_tokens,
    status,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    nullif(btrim(coalesce(p_provider, '')), ''),
    coalesce(nullif(btrim(p_feature), ''), 'operational'),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    coalesce(nullif(btrim(p_status), ''), 'logged'),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_event;

  return query select v_event.id, v_event.created_at;
end;
$$;

revoke all on function public.sincronizar_cuentas_cobrar_ventas_actual() from public;
revoke all on function public.registrar_pago_cuenta_cobrar(uuid, numeric, text, text, text) from public;
revoke all on function public.crear_proveedor(text, text, text, text, text, text) from public;
revoke all on function public.crear_orden_compra_basica(uuid, uuid, uuid, text, numeric, numeric, numeric, text) from public;
revoke all on function public.recibir_orden_compra(uuid) from public;
revoke all on function public.registrar_ai_usage_event(text, text, text, jsonb, integer, integer) from public;

grant execute on function public.sincronizar_cuentas_cobrar_ventas_actual() to authenticated;
grant execute on function public.registrar_pago_cuenta_cobrar(uuid, numeric, text, text, text) to authenticated;
grant execute on function public.crear_proveedor(text, text, text, text, text, text) to authenticated;
grant execute on function public.crear_orden_compra_basica(uuid, uuid, uuid, text, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.recibir_orden_compra(uuid) to authenticated;
grant execute on function public.registrar_ai_usage_event(text, text, text, jsonb, integer, integer) to authenticated;
