-- Align mobile dispatch completion with the canonical business receipt ledger.

create or replace function public.complete_dispatch_mobile_operation(
  p_operation_id uuid
)
returns table (
  operation_id uuid,
  operation_status text,
  dispatch_status text,
  replayed boolean,
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_operation public.dispatch_mobile_operations%rowtype;
  v_dispatch_before public.despachos%rowtype;
  v_dispatch_after public.despachos%rowtype;
  v_sale_before public.ventas%rowtype;
  v_sale_after public.ventas%rowtype;
  v_target_status text;
  v_receiver_name text;
  v_result_text text;
  v_captured_at timestamptz;
  v_latitude numeric;
  v_longitude numeric;
  v_accuracy numeric;
  v_manifest jsonb;
  v_result jsonb;
  v_error text;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('dispatch.orders.status.change') then
    raise exception 'Permiso dispatch.orders.status.change requerido.' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_company_id::text || ':dispatch.mobile:' || p_operation_id::text, 0)
  );

  select o.* into v_operation
  from public.dispatch_mobile_operations as o
  where o.empresa_id = v_company_id
    and o.operation_id = p_operation_id
  for update;

  if v_operation.id is null then
    raise exception 'Operacion movil no preparada.' using errcode = '02000';
  end if;

  if v_operation.estado = 'completed' then
    return query select
      p_operation_id,
      v_operation.estado,
      coalesce(v_operation.resultado->>'dispatchStatus', ''),
      true,
      v_operation.resultado;
    return;
  end if;

  v_target_status := v_operation.request_data->>'targetStatus';
  v_receiver_name := v_operation.request_data->>'receiverName';
  v_result_text := v_operation.request_data->>'result';
  v_captured_at := (v_operation.request_data->>'capturedAt')::timestamptz;
  v_latitude := (v_operation.request_data->>'latitude')::numeric;
  v_longitude := (v_operation.request_data->>'longitude')::numeric;
  v_accuracy := (v_operation.request_data->>'accuracyMeters')::numeric;
  v_manifest := coalesce(v_operation.request_data->'evidence', '[]'::jsonb);

  if exists (
    select 1
    from jsonb_array_elements(v_manifest) as item
    where not exists (
      select 1
      from storage.objects as obj
      where obj.bucket_id = 'dispatch-evidence'
        and obj.name = item->>'storagePath'
    )
  ) then
    raise exception 'Falta cargar uno o mas archivos de evidencia.' using errcode = '22023';
  end if;

  select d.* into v_dispatch_before
  from public.despachos as d
  where d.id = v_operation.despacho_id
    and d.empresa_id = v_company_id
  for update;

  if v_dispatch_before.id is null then
    raise exception 'Despacho no encontrado.' using errcode = '02000';
  end if;

  if v_dispatch_before.responsable_id is not null
    and v_dispatch_before.responsable_id <> v_user_id
    and not public.current_user_has_permission('dispatch.orders.edit') then
    raise exception 'El despacho esta asignado a otra persona.' using errcode = '42501';
  end if;

  if not (
    (v_target_status = 'en_ruta' and v_dispatch_before.estado in ('listo', 'en_ruta'))
    or (v_target_status = 'entregado' and v_dispatch_before.estado in ('en_ruta', 'entregado'))
    or (v_target_status = 'fallido' and v_dispatch_before.estado in ('pendiente', 'preparando', 'listo', 'en_ruta', 'fallido'))
  ) then
    v_error := 'El despacho cambio y la operacion movil requiere revision.';
    v_result := jsonb_build_object(
      'code', 'STATE_CONFLICT',
      'message', v_error,
      'dispatchStatus', v_dispatch_before.estado
    );
    update public.dispatch_mobile_operations as o
    set estado = 'incident', last_error = v_error, resultado = v_result
    where o.id = v_operation.id;
    return query select p_operation_id, 'incident'::text, v_dispatch_before.estado, false, v_result;
    return;
  end if;

  insert into public.dispatch_delivery_evidence (
    empresa_id, despacho_id, operation_id, tipo, storage_path, mime_type,
    file_name, size_bytes, captured_at, receptor_nombre, latitude, longitude,
    accuracy_meters, creado_por
  )
  select
    v_company_id,
    v_operation.despacho_id,
    p_operation_id,
    item->>'type',
    item->>'storagePath',
    item->>'mimeType',
    nullif(item->>'fileName', ''),
    (item->>'sizeBytes')::integer,
    v_captured_at,
    nullif(v_receiver_name, ''),
    v_latitude,
    v_longitude,
    v_accuracy,
    v_user_id
  from jsonb_array_elements(v_manifest) as item
  on conflict on constraint dispatch_delivery_evidence_empresa_operation_path_unique
  do nothing;

  update public.despachos as d
  set estado = v_target_status,
      resultado = coalesce(nullif(v_result_text, ''), d.resultado),
      completado_at = case when v_target_status = 'entregado' then coalesce(d.completado_at, now()) else d.completado_at end,
      actualizado_por = v_user_id
  where d.id = v_operation.despacho_id
    and d.empresa_id = v_company_id
  returning * into v_dispatch_after;

  select v.* into v_sale_before
  from public.ventas as v
  where v.id = v_dispatch_after.venta_id
    and v.empresa_id = v_company_id
  for update;

  if v_sale_before.id is not null and v_sale_before.estado <> 'cancelada' then
    update public.ventas as v
    set estado = case
          when v_target_status = 'entregado' and v.estado in ('confirmada', 'en_proceso') then 'completada'
          when v_target_status = 'en_ruta' and v.estado = 'confirmada' then 'en_proceso'
          else v.estado
        end,
        entrega_estado = case
          when v_target_status = 'entregado' then 'entregado'
          when v_target_status = 'en_ruta' and v.entrega_estado in ('pendiente', 'reservado', 'preparacion') then 'preparacion'
          else v.entrega_estado
        end,
        actualizado_por = v_user_id
    where v.id = v_dispatch_after.venta_id
      and v.empresa_id = v_company_id
    returning * into v_sale_after;
  end if;

  insert into public.auditoria_eventos (
    empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues
  )
  values (
    v_company_id,
    v_user_id,
    'despachos',
    v_dispatch_after.id,
    'complete_dispatch_mobile_operation',
    to_jsonb(v_dispatch_before),
    to_jsonb(v_dispatch_after) || jsonb_build_object(
      'operationId', p_operation_id,
      'evidenceCount', jsonb_array_length(v_manifest),
      'capturedAt', v_captured_at
    )
  );

  if v_sale_before.id is not null and v_sale_after.id is not null
    and to_jsonb(v_sale_before) is distinct from to_jsonb(v_sale_after) then
    insert into public.auditoria_eventos (
      empresa_id, usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues
    )
    values (
      v_company_id, v_user_id, 'ventas', v_sale_after.id,
      'sync_sale_from_mobile_dispatch', to_jsonb(v_sale_before), to_jsonb(v_sale_after)
    );
  end if;

  v_result := jsonb_build_object(
    'dispatchId', v_dispatch_after.id,
    'dispatchNumber', v_dispatch_after.numero,
    'dispatchStatus', v_dispatch_after.estado,
    'evidenceCount', jsonb_array_length(v_manifest),
    'completedAt', v_dispatch_after.completado_at
  );

  insert into public.business_operation_receipts (
    empresa_id, scope, idempotency_key, request_payload, result_payload, created_by
  )
  values (
    v_company_id,
    'dispatch.mobile.complete',
    p_operation_id::text,
    v_operation.request_data,
    v_result,
    v_user_id
  )
  on conflict on constraint business_operation_receipts_key_unique do nothing;

  update public.dispatch_mobile_operations as o
  set estado = 'completed',
      last_error = null,
      resultado = v_result,
      completed_at = now()
  where o.id = v_operation.id;

  return query select p_operation_id, 'completed'::text, v_dispatch_after.estado, false, v_result;
end;
$$;

revoke all on function public.complete_dispatch_mobile_operation(uuid)
  from public, anon, service_role;
grant execute on function public.complete_dispatch_mobile_operation(uuid)
  to authenticated;
