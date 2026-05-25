-- biz.os basic dispatch core.
-- Apply manually in Supabase SQL Editor after 0014.

create table public.despachos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  venta_id uuid not null,
  cliente_id uuid,
  numero text not null,
  estado text not null default 'pendiente',
  fecha_programada date,
  hora_programada time,
  responsable_id uuid,
  direccion_entrega text,
  contacto_entrega text,
  telefono_entrega text,
  notas text,
  resultado text,
  completado_at timestamptz,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint despachos_estado_check
    check (estado in ('pendiente', 'preparando', 'listo', 'en_ruta', 'entregado', 'fallido', 'cancelado')),
  constraint despachos_empresa_numero_unique unique (empresa_id, numero),
  constraint despachos_empresa_venta_unique unique (empresa_id, venta_id),
  constraint despachos_id_empresa_unique unique (id, empresa_id),
  constraint despachos_venta_empresa_fkey
    foreign key (venta_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete restrict,
  constraint despachos_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete restrict,
  constraint despachos_responsable_empresa_fkey
    foreign key (responsable_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (responsable_id),
  constraint despachos_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por),
  constraint despachos_actualizado_por_empresa_fkey
    foreign key (actualizado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (actualizado_por)
);

create index despachos_empresa_id_idx on public.despachos (empresa_id);
create index despachos_empresa_estado_idx on public.despachos (empresa_id, estado);
create index despachos_empresa_venta_idx on public.despachos (empresa_id, venta_id);
create index despachos_empresa_cliente_idx on public.despachos (empresa_id, cliente_id);
create index despachos_empresa_responsable_idx on public.despachos (empresa_id, responsable_id);
create index despachos_empresa_fecha_programada_idx on public.despachos (empresa_id, fecha_programada);
create index despachos_empresa_created_at_idx on public.despachos (empresa_id, created_at);

create trigger set_despachos_updated_at
before update on public.despachos
for each row execute function public.set_updated_at();

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('dispatch.orders.view', 'Ver despachos', 'Permite consultar despachos basicos.', 'dispatch', 'activo'),
  ('dispatch.orders.create', 'Crear despachos', 'Permite crear despachos desde ventas.', 'dispatch', 'activo'),
  ('dispatch.orders.edit', 'Editar despachos', 'Permite editar datos operativos de despachos.', 'dispatch', 'activo'),
  ('dispatch.orders.status.change', 'Cambiar estado de despachos', 'Permite avanzar estados operativos de despachos.', 'dispatch', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'dispatch.orders.view',
    'dispatch.orders.create',
    'dispatch.orders.edit',
    'dispatch.orders.status.change'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.despachos enable row level security;

grant select on public.despachos to authenticated;

create policy despachos_select_permission
on public.despachos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('dispatch.orders.view')
    or public.current_user_has_permission('dispatch.orders.create')
    or public.current_user_has_permission('dispatch.orders.edit')
  )
);

create or replace function public.crear_despacho_desde_venta(
  p_venta_id uuid,
  p_fecha_programada date default null,
  p_hora_programada time default null,
  p_responsable_id uuid default null,
  p_direccion_entrega text default null,
  p_contacto_entrega text default null,
  p_telefono_entrega text default null,
  p_notas text default null
)
returns table (despacho_id uuid, numero text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_venta public.ventas%rowtype;
  v_despacho public.despachos%rowtype;
  v_numero text;
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('dispatch.orders.create') then
    raise exception 'Permiso dispatch.orders.create requerido.' using errcode = '42501';
  end if;

  select v.* into v_venta
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id;

  if v_venta.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_venta.estado not in ('confirmada', 'en_proceso', 'completada') then
    raise exception 'La venta debe estar confirmada, en proceso o completada.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.despachos as d
    where d.empresa_id = v_empresa_id
      and d.venta_id = p_venta_id
  ) then
    raise exception 'Ya existe un despacho para esta venta.' using errcode = '23505';
  end if;

  if p_responsable_id is not null and not exists (
    select 1
    from public.profiles as p
    where p.id = p_responsable_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Responsable no disponible.' using errcode = '02000';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.despachos as d
  where d.empresa_id = v_empresa_id
    and d.numero like ('DSP-' || v_year || '-%');

  loop
    v_numero := 'DSP-' || v_year || '-' || lpad(v_seq::text, 6, '0');

    begin
      insert into public.despachos (
        empresa_id,
        venta_id,
        cliente_id,
        numero,
        fecha_programada,
        hora_programada,
        responsable_id,
        direccion_entrega,
        contacto_entrega,
        telefono_entrega,
        notas,
        creado_por,
        actualizado_por
      )
      values (
        v_empresa_id,
        v_venta.id,
        v_venta.cliente_id,
        v_numero,
        p_fecha_programada,
        p_hora_programada,
        p_responsable_id,
        nullif(btrim(coalesce(p_direccion_entrega, '')), ''),
        nullif(btrim(coalesce(p_contacto_entrega, '')), ''),
        nullif(btrim(coalesce(p_telefono_entrega, '')), ''),
        nullif(btrim(coalesce(p_notas, '')), ''),
        v_user_id,
        v_user_id
      )
      returning * into v_despacho;

      exit;
    exception
      when unique_violation then
        v_seq := v_seq + 1;
    end;
  end loop;

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
    'despachos',
    v_despacho.id,
    'crear_despacho_desde_venta',
    to_jsonb(v_despacho)
  );

  return query select v_despacho.id, v_despacho.numero;
end;
$$;

create or replace function public.actualizar_despacho(
  p_despacho_id uuid,
  p_fecha_programada date default null,
  p_hora_programada time default null,
  p_responsable_id uuid default null,
  p_direccion_entrega text default null,
  p_contacto_entrega text default null,
  p_telefono_entrega text default null,
  p_notas text default null
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
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('dispatch.orders.edit') then
    raise exception 'Permiso dispatch.orders.edit requerido.' using errcode = '42501';
  end if;

  select d.* into v_antes
  from public.despachos as d
  where d.id = p_despacho_id
    and d.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Despacho no encontrado.' using errcode = '02000';
  end if;

  if v_antes.estado in ('entregado', 'cancelado') then
    raise exception 'Despacho no editable en su estado actual.' using errcode = '22023';
  end if;

  if p_responsable_id is not null and not exists (
    select 1
    from public.profiles as p
    where p.id = p_responsable_id
      and p.empresa_id = v_empresa_id
      and p.estado = 'activo'
  ) then
    raise exception 'Responsable no disponible.' using errcode = '02000';
  end if;

  update public.despachos as d
  set fecha_programada = p_fecha_programada,
      hora_programada = p_hora_programada,
      responsable_id = p_responsable_id,
      direccion_entrega = nullif(btrim(coalesce(p_direccion_entrega, '')), ''),
      contacto_entrega = nullif(btrim(coalesce(p_contacto_entrega, '')), ''),
      telefono_entrega = nullif(btrim(coalesce(p_telefono_entrega, '')), ''),
      notas = nullif(btrim(coalesce(p_notas, '')), ''),
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
    'actualizar_despacho',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

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

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

revoke all on function public.crear_despacho_desde_venta(uuid, date, time, uuid, text, text, text, text) from public;
revoke all on function public.actualizar_despacho(uuid, date, time, uuid, text, text, text, text) from public;
revoke all on function public.cambiar_estado_despacho(uuid, text, text) from public;

grant execute on function public.crear_despacho_desde_venta(uuid, date, time, uuid, text, text, text, text) to authenticated;
grant execute on function public.actualizar_despacho(uuid, date, time, uuid, text, text, text, text) to authenticated;
grant execute on function public.cambiar_estado_despacho(uuid, text, text) to authenticated;
