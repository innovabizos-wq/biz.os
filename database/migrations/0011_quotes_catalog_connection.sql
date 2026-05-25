-- biz.os quotes to catalog connection.
-- Apply manually in Supabase SQL Editor after 0010.

create unique index if not exists catalogo_productos_id_empresa_unique_idx
  on public.catalogo_productos (id, empresa_id);

alter table public.cotizacion_items
  add column producto_id uuid;

alter table public.cotizacion_items
  add constraint cotizacion_items_producto_empresa_fkey
  foreign key (producto_id, empresa_id)
  references public.catalogo_productos(id, empresa_id)
  on delete set null (producto_id);

create index cotizacion_items_empresa_producto_idx
  on public.cotizacion_items (empresa_id, producto_id);

create index cotizacion_items_cotizacion_producto_idx
  on public.cotizacion_items (cotizacion_id, producto_id);

drop function public.agregar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric);
drop function public.actualizar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric);

create or replace function public.agregar_item_cotizacion(
  p_cotizacion_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_precio_unitario numeric,
  p_descuento numeric default 0,
  p_impuesto_porcentaje numeric default 0,
  p_producto_id uuid default null
)
returns table (
  item_id uuid,
  cotizacion_id uuid,
  total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_item public.cotizacion_items%rowtype;
  v_subtotal numeric(14, 2);
  v_base numeric(14, 2);
  v_impuesto numeric(14, 2);
  v_total numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if v_cotizacion.estado not in ('borrador', 'enviada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  if p_producto_id is not null and not exists (
    select 1
    from public.catalogo_productos as p
    where p.id = p_producto_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Producto o servicio de catalogo no disponible.' using errcode = '02000';
  end if;

  if nullif(p_descripcion, '') is null or p_cantidad <= 0 or p_precio_unitario < 0
    or coalesce(p_descuento, 0) < 0 or coalesce(p_impuesto_porcentaje, 0) < 0 then
    raise exception 'Item de cotizacion invalido.' using errcode = '22023';
  end if;

  v_subtotal := (p_cantidad * p_precio_unitario)::numeric(14, 2);
  v_base := greatest(v_subtotal - coalesce(p_descuento, 0), 0)::numeric(14, 2);
  v_impuesto := (v_base * coalesce(p_impuesto_porcentaje, 0) / 100)::numeric(14, 2);
  v_total := (v_base + v_impuesto)::numeric(14, 2);

  insert into public.cotizacion_items (
    empresa_id,
    cotizacion_id,
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
  values (
    v_empresa_id,
    p_cotizacion_id,
    p_producto_id,
    p_descripcion,
    p_cantidad,
    p_precio_unitario,
    coalesce(p_descuento, 0),
    coalesce(p_impuesto_porcentaje, 0),
    v_subtotal,
    v_impuesto,
    v_total,
    (
      select coalesce(max(i.orden), 0) + 1
      from public.cotizacion_items as i
      where i.cotizacion_id = p_cotizacion_id
        and i.empresa_id = v_empresa_id
    )
  )
  returning * into v_item;

  update public.cotizaciones as c
  set actualizado_por = v_user_id
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  perform public.recalcular_totales_cotizacion(p_cotizacion_id);

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
    'cotizacion_items',
    v_item.id,
    'agregar_item_cotizacion',
    to_jsonb(v_item)
  );

  return query select v_item.id, v_item.cotizacion_id, v_item.total;
end;
$$;

create or replace function public.actualizar_item_cotizacion(
  p_item_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_precio_unitario numeric,
  p_descuento numeric default 0,
  p_impuesto_porcentaje numeric default 0,
  p_producto_id uuid default null
)
returns table (
  item_id uuid,
  cotizacion_id uuid,
  total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_antes public.cotizacion_items%rowtype;
  v_despues public.cotizacion_items%rowtype;
  v_subtotal numeric(14, 2);
  v_base numeric(14, 2);
  v_impuesto numeric(14, 2);
  v_total numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select i.* into v_antes
  from public.cotizacion_items as i
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Item de cotizacion no encontrado.' using errcode = '02000';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = v_antes.cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.estado not in ('borrador', 'enviada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  if p_producto_id is not null and not exists (
    select 1
    from public.catalogo_productos as p
    where p.id = p_producto_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Producto o servicio de catalogo no disponible.' using errcode = '02000';
  end if;

  if nullif(p_descripcion, '') is null or p_cantidad <= 0 or p_precio_unitario < 0
    or coalesce(p_descuento, 0) < 0 or coalesce(p_impuesto_porcentaje, 0) < 0 then
    raise exception 'Item de cotizacion invalido.' using errcode = '22023';
  end if;

  v_subtotal := (p_cantidad * p_precio_unitario)::numeric(14, 2);
  v_base := greatest(v_subtotal - coalesce(p_descuento, 0), 0)::numeric(14, 2);
  v_impuesto := (v_base * coalesce(p_impuesto_porcentaje, 0) / 100)::numeric(14, 2);
  v_total := (v_base + v_impuesto)::numeric(14, 2);

  update public.cotizacion_items as i
  set
    producto_id = p_producto_id,
    descripcion = p_descripcion,
    cantidad = p_cantidad,
    precio_unitario = p_precio_unitario,
    descuento = coalesce(p_descuento, 0),
    impuesto_porcentaje = coalesce(p_impuesto_porcentaje, 0),
    subtotal = v_subtotal,
    impuesto_monto = v_impuesto,
    total = v_total
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id
  returning * into v_despues;

  update public.cotizaciones as c
  set actualizado_por = v_user_id
  where c.id = v_despues.cotizacion_id
    and c.empresa_id = v_empresa_id;

  perform public.recalcular_totales_cotizacion(v_despues.cotizacion_id);

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
    'cotizacion_items',
    p_item_id,
    'actualizar_item_cotizacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.cotizacion_id, v_despues.total;
end;
$$;

revoke all on function public.agregar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric, uuid) from public;
revoke all on function public.actualizar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric, uuid) from public;

grant execute on function public.agregar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric, uuid) to authenticated;
grant execute on function public.actualizar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric, uuid) to authenticated;
