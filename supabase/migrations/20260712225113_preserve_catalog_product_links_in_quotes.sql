create or replace function public.crear_cotizacion(
  p_cliente_id uuid,
  p_fecha_vencimiento date default null,
  p_moneda text default 'CRC',
  p_notas text default null,
  p_condiciones text default null,
  p_items jsonb default '[]'::jsonb
)
returns table (
  cotizacion_id uuid,
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
  v_item jsonb;
  v_producto_id uuid;
  v_numero text;
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.create') then
    raise exception 'Permiso quotes.create requerido.' using errcode = '42501';
  end if;

  if p_cliente_id is not null and not exists (
    select 1 from public.crm_clientes as c
    where c.id = p_cliente_id and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Items de cotizacion invalidos.' using errcode = '22023';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.cotizaciones as c
  where c.empresa_id = v_empresa_id
    and c.numero like ('COT-' || v_year || '-%');

  loop
    v_numero := 'COT-' || v_year || '-' || lpad(v_seq::text, 6, '0');

    begin
      insert into public.cotizaciones (
        empresa_id, cliente_id, numero, moneda, fecha_vencimiento, notas,
        condiciones, creado_por, actualizado_por
      ) values (
        v_empresa_id, p_cliente_id, v_numero,
        coalesce(nullif(p_moneda, ''), 'CRC'), p_fecha_vencimiento, p_notas,
        p_condiciones, v_user_id, v_user_id
      )
      returning * into v_cotizacion;

      exit;
    exception
      when unique_violation then
        v_seq := v_seq + 1;
    end;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_producto_id := nullif(v_item->>'producto_id', '')::uuid;

    if v_producto_id is not null and not exists (
      select 1 from public.catalogo_productos as p
      where p.id = v_producto_id
        and p.empresa_id = v_empresa_id
    ) then
      raise exception 'Producto de catalogo no encontrado para la empresa.' using errcode = '02000';
    end if;

    insert into public.cotizacion_items (
      empresa_id, cotizacion_id, producto_id, descripcion, cantidad,
      precio_unitario, descuento, impuesto_porcentaje, subtotal,
      impuesto_monto, total, orden
    )
    select
      v_empresa_id,
      v_cotizacion.id,
      v_producto_id,
      nullif(v_item->>'descripcion', ''),
      coalesce((v_item->>'cantidad')::numeric, 1),
      coalesce((v_item->>'precio_unitario')::numeric, 0),
      coalesce((v_item->>'descuento')::numeric, 0),
      coalesce((v_item->>'impuesto_porcentaje')::numeric, 0),
      (coalesce((v_item->>'cantidad')::numeric, 1) * coalesce((v_item->>'precio_unitario')::numeric, 0))::numeric(14, 2),
      (
        greatest(
          (coalesce((v_item->>'cantidad')::numeric, 1) * coalesce((v_item->>'precio_unitario')::numeric, 0))
          - coalesce((v_item->>'descuento')::numeric, 0),
          0
        ) * coalesce((v_item->>'impuesto_porcentaje')::numeric, 0) / 100
      )::numeric(14, 2),
      (
        greatest(
          (coalesce((v_item->>'cantidad')::numeric, 1) * coalesce((v_item->>'precio_unitario')::numeric, 0))
          - coalesce((v_item->>'descuento')::numeric, 0),
          0
        ) + (
          greatest(
            (coalesce((v_item->>'cantidad')::numeric, 1) * coalesce((v_item->>'precio_unitario')::numeric, 0))
            - coalesce((v_item->>'descuento')::numeric, 0),
            0
          ) * coalesce((v_item->>'impuesto_porcentaje')::numeric, 0) / 100
        )
      )::numeric(14, 2),
      coalesce((v_item->>'orden')::integer, 0);
  end loop;

  perform public.recalcular_totales_cotizacion(v_cotizacion.id);

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_despues
  ) values (
    v_empresa_id, v_user_id, 'cotizaciones', v_cotizacion.id,
    'crear_cotizacion', to_jsonb(v_cotizacion)
  );

  return query select v_cotizacion.id, v_cotizacion.numero;
end;
$$;
