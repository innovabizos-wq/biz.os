-- biz.os CRM followups agenda.
-- Apply manually in Supabase SQL Editor after 0007.

create or replace function public.obtener_agenda_seguimientos(
  p_scope text default 'mios',
  p_estado text default 'pendiente',
  p_desde timestamptz default null,
  p_hasta timestamptz default null
)
returns table (
  seguimiento_id uuid,
  cliente_id uuid,
  cliente_nombre text,
  cliente_telefono text,
  cliente_whatsapp text,
  asunto text,
  descripcion text,
  fecha_programada timestamptz,
  estado text,
  asignado_a uuid,
  asignado_nombre text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_scope text := coalesce(nullif(p_scope, ''), 'mios');
  v_estado text := nullif(p_estado, '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if v_scope not in ('mios', 'todos') then
    raise exception 'Scope de agenda invalido.' using errcode = '22023';
  end if;

  if v_estado is not null
    and v_estado <> 'todos'
    and v_estado not in ('pendiente', 'completado', 'cancelado') then
    raise exception 'Estado de seguimiento invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('crm.followups.view') then
    raise exception 'Permiso crm.followups.view requerido.' using errcode = '42501';
  end if;

  return query
  select
    s.id as seguimiento_id,
    c.id as cliente_id,
    c.nombre as cliente_nombre,
    c.telefono as cliente_telefono,
    c.whatsapp as cliente_whatsapp,
    s.asunto,
    s.descripcion,
    s.fecha_programada,
    s.estado,
    s.asignado_a,
    p.nombre as asignado_nombre,
    s.created_at
  from public.crm_seguimientos as s
  join public.crm_clientes as c
    on c.id = s.cliente_id
    and c.empresa_id = s.empresa_id
  left join public.profiles as p
    on p.id = s.asignado_a
    and p.empresa_id = s.empresa_id
  where s.empresa_id = v_empresa_id
    and (
      v_scope = 'todos'
      or s.asignado_a = v_user_id
      or s.asignado_a is null
    )
    and (v_estado is null or v_estado = 'todos' or s.estado = v_estado)
    and (p_desde is null or s.fecha_programada >= p_desde)
    and (p_hasta is null or s.fecha_programada <= p_hasta)
  order by s.fecha_programada asc, s.created_at asc;
end;
$$;

create or replace function public.reasignar_crm_seguimiento(
  p_seguimiento_id uuid,
  p_asignado_a uuid
)
returns table (
  seguimiento_id uuid,
  cliente_id uuid,
  estado text,
  asunto text,
  asignado_a uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.crm_seguimientos%rowtype;
  v_despues public.crm_seguimientos%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('crm.followups.edit') then
    raise exception 'Permiso crm.followups.edit requerido.' using errcode = '42501';
  end if;

  select s.*
  into v_antes
  from public.crm_seguimientos as s
  where s.id = p_seguimiento_id
    and s.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Seguimiento CRM no encontrado.' using errcode = '02000';
  end if;

  if p_asignado_a is not null and not exists (
    select 1
    from public.profiles as p
    where p.id = p_asignado_a
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Usuario asignado no pertenece a la empresa actual.' using errcode = '42501';
  end if;

  update public.crm_seguimientos as s
  set
    asignado_a = p_asignado_a,
    updated_by = v_user_id
  where s.id = p_seguimiento_id
    and s.empresa_id = v_empresa_id
  returning s.* into v_despues;

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
    'crm_seguimientos',
    p_seguimiento_id,
    'reasignar_crm_seguimiento',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query
  select
    v_despues.id,
    v_despues.cliente_id,
    v_despues.estado,
    v_despues.asunto,
    v_despues.asignado_a;
end;
$$;

revoke all on function public.obtener_agenda_seguimientos(text, text, timestamptz, timestamptz) from public;
revoke all on function public.reasignar_crm_seguimiento(uuid, uuid) from public;

grant execute on function public.obtener_agenda_seguimientos(text, text, timestamptz, timestamptz) to authenticated;
grant execute on function public.reasignar_crm_seguimiento(uuid, uuid) to authenticated;
