-- Keep the commercial order aligned with the operational dispatch lifecycle.
-- This is additive: it replaces the status RPC with the same contract and adds
-- sale status synchronization when the unique dispatch advances or is delivered.

create or replace function public.cambiar_estado_despacho(
  p_despacho_id uuid,
  p_estado text,
  p_resultado text default null
)
returns table (despacho_id uuid, numero text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.despachos%rowtype;
  v_despues public.despachos%rowtype;
  v_venta_antes public.ventas%rowtype;
  v_venta_despues public.ventas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('pendiente', 'preparando', 'listo', 'en_ruta', 'entregado', 'fallido', 'cancelado') then
    raise exception 'Estado de despacho invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('dispatch.orders.status.change') then
    raise exception 'Permiso dispatch.orders.status.change requerido.' using errcode = '42501';
  end if;

  select d.* into v_antes
  from public.despachos as d
  where d.id = p_despacho_id
    and d.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Despacho no encontrado.' using errcode = '02000';
  end if;

  if v_antes.estado in ('entregado', 'cancelado') then
    raise exception 'Despacho no modificable en su estado actual.' using errcode = '22023';
  end if;

  if not (
    (v_antes.estado = 'pendiente' and p_estado in ('preparando', 'fallido', 'cancelado'))
    or (v_antes.estado = 'preparando' and p_estado in ('listo', 'fallido', 'cancelado'))
    or (v_antes.estado = 'listo' and p_estado in ('en_ruta', 'fallido', 'cancelado'))
    or (v_antes.estado = 'en_ruta' and p_estado in ('entregado', 'fallido', 'cancelado'))
    or (v_antes.estado = p_estado)
  ) then
    raise exception 'Transicion de estado no permitida.' using errcode = '22023';
  end if;

  update public.despachos as d
  set estado = p_estado,
      resultado = nullif(btrim(coalesce(p_resultado, d.resultado, '')), ''),
      completado_at = case when p_estado = 'entregado' then now() else d.completado_at end,
      actualizado_por = v_user_id
  where d.id = p_despacho_id
    and d.empresa_id = v_empresa_id
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
    'despachos',
    p_despacho_id,
    'cambiar_estado_despacho',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  select v.* into v_venta_antes
  from public.ventas as v
  where v.id = v_despues.venta_id
    and v.empresa_id = v_empresa_id;

  if v_venta_antes.id is not null and v_venta_antes.estado not in ('completada', 'cancelada') then
    update public.ventas as v
    set estado = case
          when p_estado in ('preparando', 'listo', 'en_ruta')
            and v.estado = 'confirmada'
            then 'en_proceso'
          when p_estado = 'entregado'
            and v.estado in ('confirmada', 'en_proceso')
            then 'completada'
          else v.estado
        end,
        actualizado_por = v_user_id
    where v.id = v_despues.venta_id
      and v.empresa_id = v_empresa_id
      and (
        (p_estado in ('preparando', 'listo', 'en_ruta') and v.estado = 'confirmada')
        or (p_estado = 'entregado' and v.estado in ('confirmada', 'en_proceso'))
      )
    returning * into v_venta_despues;

    if v_venta_despues.id is not null then
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
        v_despues.venta_id,
        'sincronizar_estado_venta_desde_despacho',
        to_jsonb(v_venta_antes),
        to_jsonb(v_venta_despues)
      );
    end if;
  end if;

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

revoke all on function public.cambiar_estado_despacho(uuid, text, text) from public;
grant execute on function public.cambiar_estado_despacho(uuid, text, text) to authenticated;

update public.ventas as v
set estado = 'completada',
    actualizado_por = coalesce(d.actualizado_por, v.actualizado_por)
from public.despachos as d
where d.venta_id = v.id
  and d.empresa_id = v.empresa_id
  and d.estado = 'entregado'
  and v.estado in ('confirmada', 'en_proceso');
