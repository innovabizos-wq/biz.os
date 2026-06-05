-- Company module management RPCs.
-- Apply manually in Supabase SQL Editor. Do not run from the app.

create or replace function public.obtener_modulos_empresa_actual()
returns table (
  modulo_id uuid,
  codigo text,
  nombre text,
  descripcion text,
  catalog_status text,
  company_status text,
  is_active boolean,
  fecha_activacion timestamptz,
  fecha_desactivacion timestamptz
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

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  return query
  select
    m.id as modulo_id,
    m.codigo,
    m.nombre,
    m.descripcion,
    m.estado as catalog_status,
    em.estado as company_status,
    coalesce(em.estado = 'activo', false) as is_active,
    em.fecha_activacion,
    em.fecha_desactivacion
  from public.modulos as m
  left join public.empresa_modulos as em
    on em.modulo_id = m.id
    and em.empresa_id = v_empresa_id
  where m.estado = 'activo'
  order by m.orden asc, m.nombre asc;
end;
$$;

create or replace function public.cambiar_estado_modulo_empresa_actual(
  p_modulo_id uuid,
  p_next_state text
)
returns table (
  modulo_id uuid,
  codigo text,
  company_status text,
  is_active boolean,
  fecha_activacion timestamptz,
  fecha_desactivacion timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_modulo public.modulos%rowtype;
  v_antes public.empresa_modulos%rowtype;
  v_despues public.empresa_modulos%rowtype;
  v_next_state text := nullif(btrim(coalesce(p_next_state, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  if v_next_state not in ('activo', 'inactivo') then
    raise exception 'Estado de modulo invalido.' using errcode = '22023';
  end if;

  select m.* into v_modulo
  from public.modulos as m
  where m.id = p_modulo_id
    and m.estado = 'activo';

  if v_modulo.id is null then
    raise exception 'Modulo no encontrado o inactivo en catalogo.' using errcode = '02000';
  end if;

  select em.* into v_antes
  from public.empresa_modulos as em
  where em.empresa_id = v_empresa_id
    and em.modulo_id = p_modulo_id;

  if v_next_state = 'activo' then
    insert into public.empresa_modulos (
      empresa_id,
      modulo_id,
      estado,
      fecha_activacion,
      fecha_desactivacion,
      configuracion
    )
    values (
      v_empresa_id,
      p_modulo_id,
      'activo',
      now(),
      null,
      '{}'::jsonb
    )
    on conflict on constraint empresa_modulos_empresa_modulo_unique
    do update set
      estado = 'activo',
      fecha_activacion = case
        when public.empresa_modulos.estado = 'activo' then public.empresa_modulos.fecha_activacion
        else now()
      end,
      fecha_desactivacion = null,
      configuracion = coalesce(public.empresa_modulos.configuracion, '{}'::jsonb)
    returning * into v_despues;
  else
    if v_antes.id is null then
      insert into public.empresa_modulos (
        empresa_id,
        modulo_id,
        estado,
        fecha_activacion,
        fecha_desactivacion,
        configuracion
      )
      values (
        v_empresa_id,
        p_modulo_id,
        'inactivo',
        now(),
        now(),
        '{}'::jsonb
      )
      returning * into v_despues;
    else
      update public.empresa_modulos as em
      set
        estado = 'inactivo',
        fecha_desactivacion = now()
      where em.empresa_id = v_empresa_id
        and em.modulo_id = p_modulo_id
      returning * into v_despues;
    end if;
  end if;

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
    'empresa_modulos',
    v_despues.id,
    'cambiar_estado_modulo_empresa_actual',
    case when v_antes.id is null then null else to_jsonb(v_antes) end,
    to_jsonb(v_despues)
  );

  return query
  select
    v_modulo.id,
    v_modulo.codigo,
    v_despues.estado,
    v_despues.estado = 'activo',
    v_despues.fecha_activacion,
    v_despues.fecha_desactivacion;
end;
$$;

revoke all on function public.obtener_modulos_empresa_actual() from public;
revoke all on function public.cambiar_estado_modulo_empresa_actual(uuid, text) from public;

grant execute on function public.obtener_modulos_empresa_actual() to authenticated;
grant execute on function public.cambiar_estado_modulo_empresa_actual(uuid, text) to authenticated;
