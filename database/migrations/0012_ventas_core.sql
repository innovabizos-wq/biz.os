-- biz.os basic sales/orders core.
-- Apply manually in Supabase SQL Editor after 0011.

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cotizacion_id uuid,
  cliente_id uuid,
  numero text not null,
  estado text not null default 'nueva',
  fecha_venta date not null default current_date,
  moneda text not null default 'CRC',
  subtotal numeric(14, 2) not null default 0,
  descuento_total numeric(14, 2) not null default 0,
  impuesto_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notas text,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ventas_estado_check
    check (estado in ('nueva', 'confirmada', 'en_proceso', 'completada', 'cancelada')),
  constraint ventas_subtotal_check check (subtotal >= 0),
  constraint ventas_descuento_total_check check (descuento_total >= 0),
  constraint ventas_impuesto_total_check check (impuesto_total >= 0),
  constraint ventas_total_check check (total >= 0),
  constraint ventas_empresa_numero_unique unique (empresa_id, numero),
  constraint ventas_id_empresa_unique unique (id, empresa_id),
  constraint ventas_cotizacion_empresa_fkey
    foreign key (cotizacion_id, empresa_id)
    references public.cotizaciones(id, empresa_id)
    on delete restrict,
  constraint ventas_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete restrict,
  constraint ventas_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por),
  constraint ventas_actualizado_por_empresa_fkey
    foreign key (actualizado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (actualizado_por)
);

create unique index ventas_empresa_cotizacion_unique
  on public.ventas (empresa_id, cotizacion_id)
  where cotizacion_id is not null;

create index ventas_empresa_id_idx on public.ventas (empresa_id);
create index ventas_empresa_estado_idx on public.ventas (empresa_id, estado);
create index ventas_empresa_cliente_idx on public.ventas (empresa_id, cliente_id);
create index ventas_empresa_cotizacion_idx on public.ventas (empresa_id, cotizacion_id);
create index ventas_empresa_fecha_venta_idx on public.ventas (empresa_id, fecha_venta);
create index ventas_empresa_created_at_idx on public.ventas (empresa_id, created_at);

create trigger set_ventas_updated_at
before update on public.ventas
for each row execute function public.set_updated_at();

create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  venta_id uuid not null,
  cotizacion_item_id uuid references public.cotizacion_items(id) on delete set null,
  producto_id uuid references public.catalogo_productos(id) on delete set null,
  descripcion text not null,
  cantidad numeric(14, 2) not null default 1,
  precio_unitario numeric(14, 2) not null default 0,
  descuento numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(5, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  impuesto_monto numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),

  constraint venta_items_venta_empresa_fkey
    foreign key (venta_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete cascade,
  constraint venta_items_cantidad_check check (cantidad > 0),
  constraint venta_items_precio_unitario_check check (precio_unitario >= 0),
  constraint venta_items_descuento_check check (descuento >= 0),
  constraint venta_items_impuesto_porcentaje_check check (impuesto_porcentaje >= 0),
  constraint venta_items_subtotal_check check (subtotal >= 0),
  constraint venta_items_impuesto_monto_check check (impuesto_monto >= 0),
  constraint venta_items_total_check check (total >= 0)
);

create index venta_items_empresa_id_idx on public.venta_items (empresa_id);
create index venta_items_empresa_venta_idx on public.venta_items (empresa_id, venta_id);
create index venta_items_empresa_producto_idx on public.venta_items (empresa_id, producto_id);
create index venta_items_empresa_cotizacion_item_idx
  on public.venta_items (empresa_id, cotizacion_item_id);

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('sales.orders.view', 'Ver ventas y ordenes', 'Permite consultar ventas y ordenes basicas.', 'sales', 'activo'),
  ('sales.orders.create', 'Crear ventas y ordenes', 'Permite generar ventas desde cotizaciones aceptadas.', 'sales', 'activo'),
  ('sales.orders.edit', 'Editar ventas y ordenes', 'Permite editar notas de ventas abiertas.', 'sales', 'activo'),
  ('sales.orders.status.change', 'Cambiar estado de ventas', 'Permite cambiar estados operativos de ventas.', 'sales', 'activo')
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'sales.orders.view',
    'sales.orders.create',
    'sales.orders.edit',
    'sales.orders.status.change'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;

grant select on public.ventas to authenticated;
grant select on public.venta_items to authenticated;

create policy ventas_select_permission
on public.ventas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('sales.orders.view')
    or public.current_user_has_permission('sales.orders.create')
    or public.current_user_has_permission('sales.orders.edit')
  )
);

create policy venta_items_select_permission
on public.venta_items
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('sales.orders.view')
    or public.current_user_has_permission('sales.orders.create')
    or public.current_user_has_permission('sales.orders.edit')
  )
);

create or replace function public.generar_venta_desde_cotizacion(
  p_cotizacion_id uuid
)
returns table (
  venta_id uuid,
  numero text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_venta public.ventas%rowtype;
  v_numero text;
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('sales.orders.create') then
    raise exception 'Permiso sales.orders.create requerido.' using errcode = '42501';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if v_cotizacion.estado <> 'aceptada' then
    raise exception 'La cotizacion debe estar aceptada.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.ventas as v
    where v.empresa_id = v_empresa_id
      and v.cotizacion_id = p_cotizacion_id
  ) then
    raise exception 'Ya existe una venta para esta cotizacion.' using errcode = '23505';
  end if;

  if not exists (
    select 1
    from public.cotizacion_items as i
    where i.empresa_id = v_empresa_id
      and i.cotizacion_id = p_cotizacion_id
  ) then
    raise exception 'La cotizacion no tiene items.' using errcode = '22023';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.ventas as v
  where v.empresa_id = v_empresa_id
    and v.numero like ('VEN-' || v_year || '-%');

  loop
    v_numero := 'VEN-' || v_year || '-' || lpad(v_seq::text, 6, '0');

    begin
      insert into public.ventas (
        empresa_id,
        cotizacion_id,
        cliente_id,
        numero,
        moneda,
        subtotal,
        descuento_total,
        impuesto_total,
        total,
        notas,
        creado_por,
        actualizado_por
      )
      values (
        v_empresa_id,
        v_cotizacion.id,
        v_cotizacion.cliente_id,
        v_numero,
        v_cotizacion.moneda,
        v_cotizacion.subtotal,
        v_cotizacion.descuento_total,
        v_cotizacion.impuesto_total,
        v_cotizacion.total,
        concat_ws(E'\n\n', v_cotizacion.notas, v_cotizacion.condiciones),
        v_user_id,
        v_user_id
      )
      returning * into v_venta;

      exit;
    exception
      when unique_violation then
        v_seq := v_seq + 1;
    end;
  end loop;

  insert into public.venta_items (
    empresa_id,
    venta_id,
    cotizacion_item_id,
    producto_id,
    descripcion,
    cantidad,
    precio_unitario,
    descuento,
    impuesto_porcentaje,
    subtotal,
    impuesto_monto,
    total,
    orden
  )
  select
    v_empresa_id,
    v_venta.id,
    i.id,
    i.producto_id,
    i.descripcion,
    i.cantidad,
    i.precio_unitario,
    i.descuento,
    i.impuesto_porcentaje,
    i.subtotal,
    i.impuesto_monto,
    i.total,
    i.orden
  from public.cotizacion_items as i
  where i.empresa_id = v_empresa_id
    and i.cotizacion_id = p_cotizacion_id
  order by i.orden asc, i.created_at asc;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'ventas',
    v_venta.id,
    'generar_venta_desde_cotizacion',
    to_jsonb(v_venta)
  );

  return query select v_venta.id, v_venta.numero;
end;
$$;

create or replace function public.cambiar_estado_venta(
  p_venta_id uuid,
  p_estado text
)
returns table (
  venta_id uuid,
  numero text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.ventas%rowtype;
  v_despues public.ventas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('nueva', 'confirmada', 'en_proceso', 'completada', 'cancelada') then
    raise exception 'Estado de venta invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('sales.orders.status.change') then
    raise exception 'Permiso sales.orders.status.change requerido.' using errcode = '42501';
  end if;

  select v.* into v_antes
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_antes.estado in ('completada', 'cancelada') then
    raise exception 'Venta no modificable en su estado actual.' using errcode = '22023';
  end if;

  if not (
    (v_antes.estado = 'nueva' and p_estado in ('confirmada', 'cancelada'))
    or (v_antes.estado = 'confirmada' and p_estado in ('en_proceso', 'cancelada'))
    or (v_antes.estado = 'en_proceso' and p_estado in ('completada', 'cancelada'))
    or (v_antes.estado = p_estado)
  ) then
    raise exception 'Transicion de estado no permitida.' using errcode = '22023';
  end if;

  update public.ventas as v
  set
    estado = p_estado,
    actualizado_por = v_user_id
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'ventas',
    p_venta_id,
    'cambiar_estado_venta',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

create or replace function public.actualizar_notas_venta(
  p_venta_id uuid,
  p_notas text default null
)
returns table (
  venta_id uuid,
  numero text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.ventas%rowtype;
  v_despues public.ventas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('sales.orders.edit') then
    raise exception 'Permiso sales.orders.edit requerido.' using errcode = '42501';
  end if;

  select v.* into v_antes
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_antes.estado in ('completada', 'cancelada') then
    raise exception 'Venta no editable en su estado actual.' using errcode = '22023';
  end if;

  update public.ventas as v
  set
    notas = p_notas,
    actualizado_por = v_user_id
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'ventas',
    p_venta_id,
    'actualizar_notas_venta',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

revoke all on function public.generar_venta_desde_cotizacion(uuid) from public;
revoke all on function public.cambiar_estado_venta(uuid, text) from public;
revoke all on function public.actualizar_notas_venta(uuid, text) from public;

grant execute on function public.generar_venta_desde_cotizacion(uuid) to authenticated;
grant execute on function public.cambiar_estado_venta(uuid, text) to authenticated;
grant execute on function public.actualizar_notas_venta(uuid, text) to authenticated;
