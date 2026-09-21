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

  select po.* into v_order
  from public.purchases_orders as po
  where po.id = p_order_id
    and po.empresa_id = v_empresa_id
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
  from public.purchases_receipts as pr
  where pr.empresa_id = v_empresa_id
    and pr.order_id = p_order_id;

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

    select poi.* into v_item
    from public.purchases_order_items as poi
    where poi.id = nullif(v_item_input->>'itemId', '')::uuid
      and poi.empresa_id = v_empresa_id
      and poi.order_id = p_order_id
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

    select ist.* into v_stock
    from public.inventario_stock as ist
    where ist.empresa_id = v_empresa_id
      and ist.producto_id = v_item.producto_id
      and ist.bodega_id = v_order.bodega_id
    for update;

    v_anterior := v_stock.cantidad;
    v_nueva := v_stock.cantidad + v_qty;

    update public.inventario_stock as ist
    set cantidad = v_nueva
    where ist.id = v_stock.id
      and ist.empresa_id = v_empresa_id;

    update public.purchases_order_items as poi
    set cantidad_recibida = poi.cantidad_recibida + v_qty
    where poi.id = v_item.id
      and poi.empresa_id = v_empresa_id;

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
    from public.purchases_receipt_items as pri
    where pri.empresa_id = v_empresa_id
      and pri.receipt_id = v_receipt.id
  ) then
    raise exception 'No se recibio ninguna cantidad valida.' using errcode = '22023';
  end if;

  select coalesce(sum(poi.cantidad_recibida), 0), coalesce(sum(poi.cantidad), 0)
  into v_received_total, v_order_total_qty
  from public.purchases_order_items as poi
  where poi.empresa_id = v_empresa_id
    and poi.order_id = p_order_id;

  update public.purchases_orders as po
  set
    estado = case
      when v_received_total >= v_order_total_qty then 'recibida'
      else 'parcial'
    end,
    fecha_recepcion = case
      when v_received_total >= v_order_total_qty then current_date
      else po.fecha_recepcion
    end,
    received_at = case
      when v_received_total >= v_order_total_qty then now()
      else po.received_at
    end,
    updated_by = v_user_id
  where po.id = p_order_id
    and po.empresa_id = v_empresa_id
  returning po.* into v_order;

  perform public.sync_payable_account_for_purchase(v_empresa_id, p_order_id, v_user_id);

  return query
  select
    v_receipt.id,
    v_order.id,
    v_order.estado,
    v_receipt.received_at;
end;
$$;

revoke all on function public.recibir_orden_compra_parcial(uuid, jsonb, text) from public;
grant execute on function public.recibir_orden_compra_parcial(uuid, jsonb, text) to authenticated;
