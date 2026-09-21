-- Commercial foundation: atomic inventory transfers and platform-only Meta rate writes.
-- Additive migration. Safe to apply after the current inventory and Whapp migrations.

create table if not exists public.business_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  scope text not null,
  idempotency_key text not null,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint business_operation_receipts_key_unique
    unique (empresa_id, scope, idempotency_key),
  constraint business_operation_receipts_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index if not exists business_operation_receipts_created_at_idx
  on public.business_operation_receipts (empresa_id, created_at desc);

alter table public.business_operation_receipts enable row level security;

revoke all on table public.business_operation_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.business_operation_receipts to service_role;

create or replace function public.transferir_inventario_entre_bodegas(
  p_producto_id uuid,
  p_bodega_origen_id uuid,
  p_bodega_destino_id uuid,
  p_cantidad numeric,
  p_motivo text,
  p_idempotency_key text
)
returns table (
  transfer_id uuid,
  salida_movimiento_id uuid,
  entrada_movimiento_id uuid,
  cantidad_origen numeric,
  cantidad_destino numeric,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_receipt public.business_operation_receipts%rowtype;
  v_request jsonb;
  v_transfer_id uuid;
  v_salida_id uuid;
  v_entrada_id uuid;
  v_origen numeric(14, 2);
  v_destino numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inventory.stock.adjust') then
    raise exception 'Permiso inventory.stock.adjust requerido.' using errcode = '42501';
  end if;

  if p_producto_id is null
    or p_bodega_origen_id is null
    or p_bodega_destino_id is null
    or p_bodega_origen_id = p_bodega_destino_id
    or coalesce(p_cantidad, 0) <= 0
  then
    raise exception 'Traslado de inventario invalido.' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key, '')), '') is null
    or length(p_idempotency_key) > 200
  then
    raise exception 'Clave idempotente requerida.' using errcode = '22023';
  end if;

  v_request := jsonb_build_object(
    'producto_id', p_producto_id,
    'bodega_origen_id', p_bodega_origen_id,
    'bodega_destino_id', p_bodega_destino_id,
    'cantidad', p_cantidad,
    'motivo', nullif(btrim(coalesce(p_motivo, '')), '')
  );

  -- Serialize only requests with the same company/scope/key.
  perform pg_advisory_xact_lock(
    hashtextextended(
      v_empresa_id::text || ':inventory.transfer:' || btrim(p_idempotency_key),
      0
    )
  );

  select r.*
    into v_receipt
  from public.business_operation_receipts as r
  where r.empresa_id = v_empresa_id
    and r.scope = 'inventory.transfer'
    and r.idempotency_key = btrim(p_idempotency_key);

  if found then
    if v_receipt.request_payload <> v_request then
      raise exception 'La clave idempotente ya fue usada con otros datos.'
        using errcode = '23505';
    end if;

    return query
    select
      (v_receipt.result_payload ->> 'transfer_id')::uuid,
      (v_receipt.result_payload ->> 'salida_movimiento_id')::uuid,
      (v_receipt.result_payload ->> 'entrada_movimiento_id')::uuid,
      (v_receipt.result_payload ->> 'cantidad_origen')::numeric,
      (v_receipt.result_payload ->> 'cantidad_destino')::numeric,
      true;
    return;
  end if;

  if not exists (
    select 1
    from public.catalogo_productos as p
    where p.id = p_producto_id
      and p.empresa_id = v_empresa_id
      and p.tipo = 'producto'
      and p.estado = 'activo'
  ) then
    raise exception 'Producto de inventario no disponible.' using errcode = '02000';
  end if;

  if (
    select count(*)
    from public.inventario_bodegas as b
    where b.empresa_id = v_empresa_id
      and b.id in (p_bodega_origen_id, p_bodega_destino_id)
      and b.estado = 'activa'
  ) <> 2 then
    raise exception 'Bodega de origen o destino no disponible.' using errcode = '02000';
  end if;

  insert into public.inventario_stock (empresa_id, producto_id, bodega_id, cantidad)
  values
    (v_empresa_id, p_producto_id, p_bodega_origen_id, 0),
    (v_empresa_id, p_producto_id, p_bodega_destino_id, 0)
  on conflict on constraint inventario_stock_empresa_producto_bodega_unique
  do nothing;

  -- Acquire both stock locks in a stable order to avoid opposite-transfer deadlocks.
  perform 1
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_producto_id
    and s.bodega_id in (p_bodega_origen_id, p_bodega_destino_id)
  order by s.id
  for update;

  v_transfer_id := gen_random_uuid();

  select m.movimiento_id
    into v_salida_id
  from public.registrar_movimiento_inventario(
    p_producto_id,
    p_bodega_origen_id,
    'salida',
    p_cantidad,
    coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Traslado entre bodegas'),
    'traslado_bodega',
    v_transfer_id
  ) as m;

  select m.movimiento_id
    into v_entrada_id
  from public.registrar_movimiento_inventario(
    p_producto_id,
    p_bodega_destino_id,
    'entrada',
    p_cantidad,
    coalesce(nullif(btrim(coalesce(p_motivo, '')), ''), 'Traslado entre bodegas'),
    'traslado_bodega',
    v_transfer_id
  ) as m;

  select s.cantidad
    into v_origen
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_producto_id
    and s.bodega_id = p_bodega_origen_id;

  select s.cantidad
    into v_destino
  from public.inventario_stock as s
  where s.empresa_id = v_empresa_id
    and s.producto_id = p_producto_id
    and s.bodega_id = p_bodega_destino_id;

  insert into public.business_operation_receipts (
    empresa_id,
    scope,
    idempotency_key,
    request_payload,
    result_payload,
    created_by
  )
  values (
    v_empresa_id,
    'inventory.transfer',
    btrim(p_idempotency_key),
    v_request,
    jsonb_build_object(
      'transfer_id', v_transfer_id,
      'salida_movimiento_id', v_salida_id,
      'entrada_movimiento_id', v_entrada_id,
      'cantidad_origen', v_origen,
      'cantidad_destino', v_destino
    ),
    v_user_id
  );

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
    'inventario_traslados',
    v_transfer_id,
    'transferir_inventario_entre_bodegas',
    jsonb_build_object(
      'producto_id', p_producto_id,
      'bodega_origen_id', p_bodega_origen_id,
      'bodega_destino_id', p_bodega_destino_id,
      'cantidad', p_cantidad,
      'salida_movimiento_id', v_salida_id,
      'entrada_movimiento_id', v_entrada_id
    )
  );

  return query
  select
    v_transfer_id,
    v_salida_id,
    v_entrada_id,
    v_origen,
    v_destino,
    false;
end;
$$;

revoke all on function public.transferir_inventario_entre_bodegas(
  uuid, uuid, uuid, numeric, text, text
) from public, anon;
grant execute on function public.transferir_inventario_entre_bodegas(
  uuid, uuid, uuid, numeric, text, text
) to authenticated;

-- Platform operators manage the global Meta rate table through their authenticated session.
grant select, insert, update on table public.inbox_meta_tarifas to authenticated;

drop policy if exists inbox_meta_tarifas_insert_platform on public.inbox_meta_tarifas;
create policy inbox_meta_tarifas_insert_platform
on public.inbox_meta_tarifas
for insert
to authenticated
with check (
  (select public.current_user_is_platform_user(array['owner', 'admin']))
);

drop policy if exists inbox_meta_tarifas_update_platform on public.inbox_meta_tarifas;
create policy inbox_meta_tarifas_update_platform
on public.inbox_meta_tarifas
for update
to authenticated
using (
  (select public.current_user_is_platform_user(array['owner', 'admin']))
)
with check (
  (select public.current_user_is_platform_user(array['owner', 'admin']))
);
