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
    select 1 from public.purchases_suppliers as s
    where s.id = p_supplier_id
      and s.empresa_id = v_empresa_id
      and s.estado = 'activo'
  ) then
    raise exception 'Proveedor no disponible.' using errcode = '02000';
  end if;

  if not exists (
    select 1 from public.inventario_bodegas as b
    where b.id = p_bodega_id
      and b.empresa_id = v_empresa_id
      and b.estado = 'activa'
  ) then
    raise exception 'Bodega no disponible.' using errcode = '02000';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.purchases_orders as po
  where po.empresa_id = v_empresa_id
    and date_part('year', po.created_at) = date_part('year', now());

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

    select p.* into v_product
    from public.catalogo_productos as p
    where p.id = nullif(v_item->>'productoId', '')::uuid
      and p.empresa_id = v_empresa_id
      and p.tipo = 'producto'
      and p.estado = 'activo';

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

  update public.purchases_orders as po
  set
    subtotal = v_order_subtotal,
    impuesto_total = v_order_tax,
    total = v_order_total,
    updated_by = v_user_id
  where po.id = v_order.id
    and po.empresa_id = v_empresa_id
  returning po.* into v_order;

  return query
  select
    v_order.id,
    v_order.numero,
    v_order.estado,
    v_order.total;
end;
$$;

revoke all on function public.crear_orden_compra_completa(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.crear_orden_compra_completa(uuid, uuid, jsonb, text, text) to authenticated;
