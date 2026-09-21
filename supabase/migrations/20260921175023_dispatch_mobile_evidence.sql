-- Durable mobile dispatch completion with private evidence and safe offline retries.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dispatch-evidence',
  'dispatch-evidence',
  false,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.dispatch_mobile_operations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  operation_id uuid not null,
  despacho_id uuid not null,
  request_hash text not null,
  request_data jsonb not null default '{}'::jsonb,
  estado text not null default 'pending',
  last_error text,
  resultado jsonb,
  creado_por uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dispatch_mobile_operations_estado_check
    check (estado in ('pending', 'incident', 'completed')),
  constraint dispatch_mobile_operations_request_data_check
    check (jsonb_typeof(request_data) = 'object'),
  constraint dispatch_mobile_operations_empresa_operation_unique
    unique (empresa_id, operation_id),
  constraint dispatch_mobile_operations_despacho_empresa_fkey
    foreign key (despacho_id, empresa_id)
    references public.despachos(id, empresa_id)
    on delete cascade,
  constraint dispatch_mobile_operations_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete restrict
);

create index if not exists dispatch_mobile_operations_empresa_despacho_idx
  on public.dispatch_mobile_operations (empresa_id, despacho_id, created_at desc);
create index if not exists dispatch_mobile_operations_despacho_empresa_fkey_idx
  on public.dispatch_mobile_operations (despacho_id, empresa_id);
create index if not exists dispatch_mobile_operations_created_by_empresa_fkey_idx
  on public.dispatch_mobile_operations (creado_por, empresa_id);
create index if not exists dispatch_mobile_operations_pending_idx
  on public.dispatch_mobile_operations (empresa_id, estado, updated_at)
  where estado in ('pending', 'incident');

drop trigger if exists set_dispatch_mobile_operations_updated_at
  on public.dispatch_mobile_operations;
create trigger set_dispatch_mobile_operations_updated_at
before update on public.dispatch_mobile_operations
for each row execute function public.set_updated_at();

create table if not exists public.dispatch_delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  despacho_id uuid not null,
  operation_id uuid not null,
  tipo text not null,
  storage_path text not null,
  mime_type text not null,
  file_name text,
  size_bytes integer not null,
  captured_at timestamptz not null,
  receptor_nombre text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  accuracy_meters numeric(10, 2),
  creado_por uuid not null,
  created_at timestamptz not null default now(),

  constraint dispatch_delivery_evidence_tipo_check
    check (tipo in ('photo', 'signature')),
  constraint dispatch_delivery_evidence_mime_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint dispatch_delivery_evidence_size_check
    check (size_bytes > 0 and size_bytes <= 6291456),
  constraint dispatch_delivery_evidence_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint dispatch_delivery_evidence_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint dispatch_delivery_evidence_accuracy_check
    check (accuracy_meters is null or accuracy_meters >= 0),
  constraint dispatch_delivery_evidence_empresa_operation_path_unique
    unique (empresa_id, operation_id, storage_path),
  constraint dispatch_delivery_evidence_despacho_empresa_fkey
    foreign key (despacho_id, empresa_id)
    references public.despachos(id, empresa_id)
    on delete cascade,
  constraint dispatch_delivery_evidence_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete restrict
);

create index if not exists dispatch_delivery_evidence_empresa_despacho_idx
  on public.dispatch_delivery_evidence (empresa_id, despacho_id, captured_at desc);
create index if not exists dispatch_delivery_evidence_despacho_empresa_fkey_idx
  on public.dispatch_delivery_evidence (despacho_id, empresa_id);
create index if not exists dispatch_delivery_evidence_created_by_empresa_fkey_idx
  on public.dispatch_delivery_evidence (creado_por, empresa_id);

alter table public.dispatch_mobile_operations enable row level security;
alter table public.dispatch_delivery_evidence enable row level security;

revoke all on table public.dispatch_mobile_operations from public, anon, authenticated;
revoke all on table public.dispatch_delivery_evidence from public, anon, authenticated;
grant select, insert, update, delete on table public.dispatch_mobile_operations to service_role;
grant select, insert, update, delete on table public.dispatch_delivery_evidence to service_role;
grant select on table public.dispatch_delivery_evidence to authenticated;

drop policy if exists dispatch_delivery_evidence_select_permission
  on public.dispatch_delivery_evidence;
create policy dispatch_delivery_evidence_select_permission
on public.dispatch_delivery_evidence
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('dispatch.orders.view'))
    or (select public.current_user_has_permission('dispatch.orders.status.change'))
  )
);

drop policy if exists dispatch_evidence_storage_select
  on storage.objects;
create policy dispatch_evidence_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'dispatch-evidence'
  and (storage.foldername(name))[1] = (select public.current_empresa_id())::text
  and (
    (select public.current_user_has_permission('dispatch.orders.view'))
    or (select public.current_user_has_permission('dispatch.orders.status.change'))
  )
);

drop policy if exists dispatch_evidence_storage_insert
  on storage.objects;
create policy dispatch_evidence_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'dispatch-evidence'
  and (storage.foldername(name))[1] = (select public.current_empresa_id())::text
  and (select public.current_user_has_permission('dispatch.orders.status.change'))
);

drop policy if exists dispatch_evidence_storage_update
  on storage.objects;
create policy dispatch_evidence_storage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'dispatch-evidence'
  and (storage.foldername(name))[1] = (select public.current_empresa_id())::text
  and (select public.current_user_has_permission('dispatch.orders.status.change'))
)
with check (
  bucket_id = 'dispatch-evidence'
  and (storage.foldername(name))[1] = (select public.current_empresa_id())::text
  and (select public.current_user_has_permission('dispatch.orders.status.change'))
);

drop policy if exists dispatch_evidence_storage_delete
  on storage.objects;
create policy dispatch_evidence_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'dispatch-evidence'
  and (storage.foldername(name))[1] = (select public.current_empresa_id())::text
  and (select public.current_user_has_permission('dispatch.orders.status.change'))
);

create or replace function public.prepare_dispatch_mobile_operation(
  p_operation_id uuid,
  p_dispatch_id uuid,
  p_target_status text,
  p_receiver_name text default null,
  p_result text default null,
  p_captured_at timestamptz default now(),
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_evidence_manifest jsonb default '[]'::jsonb
)
returns table (
  operation_id uuid,
  operation_status text,
  result jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_dispatch public.despachos%rowtype;
  v_existing public.dispatch_mobile_operations%rowtype;
  v_request jsonb;
  v_hash text;
  v_item jsonb;
  v_expected_prefix text;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('dispatch.orders.status.change') then
    raise exception 'Permiso dispatch.orders.status.change requerido.' using errcode = '42501';
  end if;

  if p_operation_id is null or p_dispatch_id is null then
    raise exception 'Operacion y despacho requeridos.' using errcode = '22023';
  end if;

  if p_target_status not in ('en_ruta', 'entregado', 'fallido') then
    raise exception 'Estado movil de despacho invalido.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_evidence_manifest, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_evidence_manifest, '[]'::jsonb)) > 4 then
    raise exception 'Manifiesto de evidencia invalido.' using errcode = '22023';
  end if;

  if p_target_status = 'entregado' and (
    nullif(btrim(coalesce(p_receiver_name, '')), '') is null
    or jsonb_array_length(coalesce(p_evidence_manifest, '[]'::jsonb)) = 0
  ) then
    raise exception 'La entrega requiere receptor y al menos una foto o firma.' using errcode = '22023';
  end if;

  if p_target_status = 'fallido'
    and nullif(btrim(coalesce(p_result, '')), '') is null then
    raise exception 'El intento fallido requiere un resultado.' using errcode = '22023';
  end if;

  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'Latitud invalida.' using errcode = '22023';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'Longitud invalida.' using errcode = '22023';
  end if;
  if p_accuracy_meters is not null and p_accuracy_meters < 0 then
    raise exception 'Precision de ubicacion invalida.' using errcode = '22023';
  end if;

  v_expected_prefix := v_company_id::text || '/' || p_dispatch_id::text || '/' || p_operation_id::text || '/';
  for v_item in select value from jsonb_array_elements(coalesce(p_evidence_manifest, '[]'::jsonb))
  loop
    if coalesce(v_item->>'type', '') not in ('photo', 'signature')
      or coalesce(v_item->>'mimeType', '') not in ('image/jpeg', 'image/png', 'image/webp')
      or coalesce((v_item->>'sizeBytes')::integer, 0) <= 0
      or coalesce((v_item->>'sizeBytes')::integer, 0) > 6291456
      or left(coalesce(v_item->>'storagePath', ''), length(v_expected_prefix)) <> v_expected_prefix then
      raise exception 'Archivo de evidencia invalido.' using errcode = '22023';
    end if;
  end loop;

  v_request := jsonb_build_object(
    'dispatchId', p_dispatch_id,
    'targetStatus', p_target_status,
    'receiverName', nullif(btrim(coalesce(p_receiver_name, '')), ''),
    'result', nullif(btrim(coalesce(p_result, '')), ''),
    'capturedAt', coalesce(p_captured_at, now()),
    'latitude', p_latitude,
    'longitude', p_longitude,
    'accuracyMeters', p_accuracy_meters,
    'evidence', coalesce(p_evidence_manifest, '[]'::jsonb)
  );
  v_hash := md5(v_request::text);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_company_id::text || ':dispatch.mobile:' || p_operation_id::text, 0)
  );

  select o.* into v_existing
  from public.dispatch_mobile_operations as o
  where o.empresa_id = v_company_id
    and o.operation_id = p_operation_id
  for update;

  if v_existing.id is not null then
    if v_existing.request_hash <> v_hash then
      raise exception 'La clave de operacion ya fue usada con contenido diferente.' using errcode = '23505';
    end if;

    if v_existing.estado = 'incident' then
      update public.dispatch_mobile_operations as o
      set estado = 'pending', last_error = null
      where o.id = v_existing.id;
      v_existing.estado := 'pending';
    end if;

    return query select p_operation_id, v_existing.estado, v_existing.resultado;
    return;
  end if;

  select d.* into v_dispatch
  from public.despachos as d
  where d.id = p_dispatch_id
    and d.empresa_id = v_company_id;

  if v_dispatch.id is null then
    raise exception 'Despacho no encontrado.' using errcode = '02000';
  end if;

  if v_dispatch.responsable_id is not null
    and v_dispatch.responsable_id <> v_user_id
    and not public.current_user_has_permission('dispatch.orders.edit') then
    raise exception 'El despacho esta asignado a otra persona.' using errcode = '42501';
  end if;

  insert into public.dispatch_mobile_operations (
    empresa_id, operation_id, despacho_id, request_hash, request_data,
    estado, creado_por
  )
  values (
    v_company_id, p_operation_id, p_dispatch_id, v_hash, v_request,
    'pending', v_user_id
  );

  return query select p_operation_id, 'pending'::text, null::jsonb;
end;
$$;

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

revoke all on function public.prepare_dispatch_mobile_operation(
  uuid, uuid, text, text, text, timestamptz, numeric, numeric, numeric, jsonb
) from public, anon, service_role;
revoke all on function public.complete_dispatch_mobile_operation(uuid)
  from public, anon, service_role;

grant execute on function public.prepare_dispatch_mobile_operation(
  uuid, uuid, text, text, text, timestamptz, numeric, numeric, numeric, jsonb
) to authenticated;
grant execute on function public.complete_dispatch_mobile_operation(uuid)
  to authenticated;

comment on table public.dispatch_mobile_operations is
  'Durable and idempotent dispatch operations captured by the installable mobile web app.';
comment on table public.dispatch_delivery_evidence is
  'Private photo or signature evidence for dispatch completion, scoped by company and permission.';
