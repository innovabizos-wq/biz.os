-- biz.os basic quotes core.
-- Apply manually in Supabase SQL Editor after 0008.

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cliente_id uuid,
  numero text not null,
  estado text not null default 'borrador',
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  moneda text not null default 'CRC',
  subtotal numeric(14, 2) not null default 0,
  descuento_total numeric(14, 2) not null default 0,
  impuesto_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notas text,
  condiciones text,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cotizaciones_estado_check
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'anulada')),
  constraint cotizaciones_subtotal_check check (subtotal >= 0),
  constraint cotizaciones_descuento_total_check check (descuento_total >= 0),
  constraint cotizaciones_impuesto_total_check check (impuesto_total >= 0),
  constraint cotizaciones_total_check check (total >= 0),
  constraint cotizaciones_empresa_numero_unique unique (empresa_id, numero),
  constraint cotizaciones_id_empresa_unique unique (id, empresa_id),
  constraint cotizaciones_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete restrict,
  constraint cotizaciones_creado_por_empresa_fkey
    foreign key (creado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (creado_por),
  constraint cotizaciones_actualizado_por_empresa_fkey
    foreign key (actualizado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (actualizado_por)
);

create index cotizaciones_empresa_id_idx on public.cotizaciones (empresa_id);
create index cotizaciones_empresa_estado_idx on public.cotizaciones (empresa_id, estado);
create index cotizaciones_empresa_cliente_idx on public.cotizaciones (empresa_id, cliente_id);
create index cotizaciones_empresa_fecha_emision_idx on public.cotizaciones (empresa_id, fecha_emision);
create index cotizaciones_empresa_created_at_idx on public.cotizaciones (empresa_id, created_at);

create trigger set_cotizaciones_updated_at
before update on public.cotizaciones
for each row execute function public.set_updated_at();

create table public.cotizacion_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cotizacion_id uuid not null,
  descripcion text not null,
  cantidad numeric(14, 2) not null default 1,
  precio_unitario numeric(14, 2) not null default 0,
  descuento numeric(14, 2) not null default 0,
  impuesto_porcentaje numeric(5, 2) not null default 0,
  subtotal numeric(14, 2) not null default 0,
  impuesto_monto numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cotizacion_items_cantidad_check check (cantidad > 0),
  constraint cotizacion_items_precio_unitario_check check (precio_unitario >= 0),
  constraint cotizacion_items_descuento_check check (descuento >= 0),
  constraint cotizacion_items_impuesto_porcentaje_check check (impuesto_porcentaje >= 0),
  constraint cotizacion_items_subtotal_check check (subtotal >= 0),
  constraint cotizacion_items_impuesto_monto_check check (impuesto_monto >= 0),
  constraint cotizacion_items_total_check check (total >= 0),
  constraint cotizacion_items_cotizacion_empresa_fkey
    foreign key (cotizacion_id, empresa_id)
    references public.cotizaciones(id, empresa_id)
    on delete cascade
);

create index cotizacion_items_empresa_cotizacion_idx
  on public.cotizacion_items (empresa_id, cotizacion_id);

create trigger set_cotizacion_items_updated_at
before update on public.cotizacion_items
for each row execute function public.set_updated_at();

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('quotes.view', 'Ver cotizaciones', 'Permite consultar cotizaciones basicas.', 'crm', 'activo'),
  ('quotes.create', 'Crear cotizaciones', 'Permite crear cotizaciones basicas desde CRM.', 'crm', 'activo'),
  ('quotes.edit', 'Editar cotizaciones', 'Permite editar datos e items de cotizaciones basicas.', 'crm', 'activo'),
  ('quotes.status.change', 'Cambiar estado de cotizaciones', 'Permite cambiar estados comerciales de cotizaciones.', 'crm', 'activo')
on conflict (codigo) do update
set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'quotes.view',
    'quotes.create',
    'quotes.edit',
    'quotes.status.change'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;

grant select on public.cotizaciones to authenticated;
grant select on public.cotizacion_items to authenticated;

create policy cotizaciones_select_permission
on public.cotizaciones
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('quotes.view')
    or public.current_user_has_permission('quotes.create')
    or public.current_user_has_permission('quotes.edit')
  )
);

create policy cotizacion_items_select_permission
on public.cotizacion_items
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('quotes.view')
    or public.current_user_has_permission('quotes.create')
    or public.current_user_has_permission('quotes.edit')
  )
);

create or replace function public.recalcular_totales_cotizacion(
  p_cotizacion_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  update public.cotizaciones as c
  set
    subtotal = coalesce(t.subtotal, 0),
    descuento_total = coalesce(t.descuento_total, 0),
    impuesto_total = coalesce(t.impuesto_total, 0),
    total = coalesce(t.total, 0)
  from (
    select
      coalesce(sum(i.subtotal), 0)::numeric(14, 2) as subtotal,
      coalesce(sum(i.descuento), 0)::numeric(14, 2) as descuento_total,
      coalesce(sum(i.impuesto_monto), 0)::numeric(14, 2) as impuesto_total,
      coalesce(sum(i.total), 0)::numeric(14, 2) as total
    from public.cotizacion_items as i
    where i.cotizacion_id = p_cotizacion_id
      and i.empresa_id = v_empresa_id
  ) as t
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;
end;
$$;

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
        empresa_id,
        cliente_id,
        numero,
        moneda,
        fecha_vencimiento,
        notas,
        condiciones,
        creado_por,
        actualizado_por
      )
      values (
        v_empresa_id,
        p_cliente_id,
        v_numero,
        coalesce(nullif(p_moneda, ''), 'CRC'),
        p_fecha_vencimiento,
        p_notas,
        p_condiciones,
        v_user_id,
        v_user_id
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
    insert into public.cotizacion_items (
      empresa_id,
      cotizacion_id,
      descripcion,
      cantidad,
      precio_unitario,
      descuento,
      impuesto_porcentaje,
      subtotal,
      impuesto_monto,
      total,
      orden
    )
    select
      v_empresa_id,
      v_cotizacion.id,
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
        )
        + (
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
    'cotizaciones',
    v_cotizacion.id,
    'crear_cotizacion',
    to_jsonb(v_cotizacion)
  );

  return query select v_cotizacion.id, v_cotizacion.numero;
end;
$$;

create or replace function public.actualizar_cotizacion(
  p_cotizacion_id uuid,
  p_cliente_id uuid,
  p_fecha_vencimiento date default null,
  p_moneda text default 'CRC',
  p_notas text default null,
  p_condiciones text default null
)
returns table (
  cotizacion_id uuid,
  numero text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.cotizaciones%rowtype;
  v_despues public.cotizaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select c.* into v_antes
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if v_antes.estado in ('aceptada', 'anulada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  if p_cliente_id is not null and not exists (
    select 1 from public.crm_clientes as c
    where c.id = p_cliente_id and c.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  update public.cotizaciones as c
  set
    cliente_id = p_cliente_id,
    fecha_vencimiento = p_fecha_vencimiento,
    moneda = coalesce(nullif(p_moneda, ''), 'CRC'),
    notas = p_notas,
    condiciones = p_condiciones,
    actualizado_por = v_user_id
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id
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
    'cotizaciones',
    p_cotizacion_id,
    'actualizar_cotizacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

create or replace function public.agregar_item_cotizacion(
  p_cotizacion_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_precio_unitario numeric,
  p_descuento numeric default 0,
  p_impuesto_porcentaje numeric default 0
)
returns table (
  item_id uuid,
  cotizacion_id uuid,
  total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_item public.cotizacion_items%rowtype;
  v_subtotal numeric(14, 2);
  v_base numeric(14, 2);
  v_impuesto numeric(14, 2);
  v_total numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if v_cotizacion.estado not in ('borrador', 'enviada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  if nullif(p_descripcion, '') is null or p_cantidad <= 0 or p_precio_unitario < 0
    or coalesce(p_descuento, 0) < 0 or coalesce(p_impuesto_porcentaje, 0) < 0 then
    raise exception 'Item de cotizacion invalido.' using errcode = '22023';
  end if;

  v_subtotal := (p_cantidad * p_precio_unitario)::numeric(14, 2);
  v_base := greatest(v_subtotal - coalesce(p_descuento, 0), 0)::numeric(14, 2);
  v_impuesto := (v_base * coalesce(p_impuesto_porcentaje, 0) / 100)::numeric(14, 2);
  v_total := (v_base + v_impuesto)::numeric(14, 2);

  insert into public.cotizacion_items (
    empresa_id,
    cotizacion_id,
    descripcion,
    cantidad,
    precio_unitario,
    descuento,
    impuesto_porcentaje,
    subtotal,
    impuesto_monto,
    total,
    orden
  )
  values (
    v_empresa_id,
    p_cotizacion_id,
    p_descripcion,
    p_cantidad,
    p_precio_unitario,
    coalesce(p_descuento, 0),
    coalesce(p_impuesto_porcentaje, 0),
    v_subtotal,
    v_impuesto,
    v_total,
    (select coalesce(max(i.orden), 0) + 1 from public.cotizacion_items as i where i.cotizacion_id = p_cotizacion_id and i.empresa_id = v_empresa_id)
  )
  returning * into v_item;

  update public.cotizaciones as c
  set actualizado_por = v_user_id
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  perform public.recalcular_totales_cotizacion(p_cotizacion_id);

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
    'cotizacion_items',
    v_item.id,
    'agregar_item_cotizacion',
    to_jsonb(v_item)
  );

  return query select v_item.id, v_item.cotizacion_id, v_item.total;
end;
$$;

create or replace function public.actualizar_item_cotizacion(
  p_item_id uuid,
  p_descripcion text,
  p_cantidad numeric,
  p_precio_unitario numeric,
  p_descuento numeric default 0,
  p_impuesto_porcentaje numeric default 0
)
returns table (
  item_id uuid,
  cotizacion_id uuid,
  total numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_antes public.cotizacion_items%rowtype;
  v_despues public.cotizacion_items%rowtype;
  v_subtotal numeric(14, 2);
  v_base numeric(14, 2);
  v_impuesto numeric(14, 2);
  v_total numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select i.* into v_antes
  from public.cotizacion_items as i
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Item de cotizacion no encontrado.' using errcode = '02000';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = v_antes.cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.estado not in ('borrador', 'enviada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  if nullif(p_descripcion, '') is null or p_cantidad <= 0 or p_precio_unitario < 0
    or coalesce(p_descuento, 0) < 0 or coalesce(p_impuesto_porcentaje, 0) < 0 then
    raise exception 'Item de cotizacion invalido.' using errcode = '22023';
  end if;

  v_subtotal := (p_cantidad * p_precio_unitario)::numeric(14, 2);
  v_base := greatest(v_subtotal - coalesce(p_descuento, 0), 0)::numeric(14, 2);
  v_impuesto := (v_base * coalesce(p_impuesto_porcentaje, 0) / 100)::numeric(14, 2);
  v_total := (v_base + v_impuesto)::numeric(14, 2);

  update public.cotizacion_items as i
  set
    descripcion = p_descripcion,
    cantidad = p_cantidad,
    precio_unitario = p_precio_unitario,
    descuento = coalesce(p_descuento, 0),
    impuesto_porcentaje = coalesce(p_impuesto_porcentaje, 0),
    subtotal = v_subtotal,
    impuesto_monto = v_impuesto,
    total = v_total
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id
  returning * into v_despues;

  update public.cotizaciones as c
  set actualizado_por = v_user_id
  where c.id = v_despues.cotizacion_id
    and c.empresa_id = v_empresa_id;

  perform public.recalcular_totales_cotizacion(v_despues.cotizacion_id);

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
    'cotizacion_items',
    p_item_id,
    'actualizar_item_cotizacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.cotizacion_id, v_despues.total;
end;
$$;

create or replace function public.eliminar_item_cotizacion(
  p_item_id uuid
)
returns table (
  item_id uuid,
  cotizacion_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
  v_antes public.cotizacion_items%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('quotes.edit') then
    raise exception 'Permiso quotes.edit requerido.' using errcode = '42501';
  end if;

  select i.* into v_antes
  from public.cotizacion_items as i
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Item de cotizacion no encontrado.' using errcode = '02000';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = v_antes.cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.estado not in ('borrador', 'enviada') then
    raise exception 'Cotizacion no editable en su estado actual.' using errcode = '22023';
  end if;

  delete from public.cotizacion_items as i
  where i.id = p_item_id
    and i.empresa_id = v_empresa_id;

  update public.cotizaciones as c
  set actualizado_por = v_user_id
  where c.id = v_antes.cotizacion_id
    and c.empresa_id = v_empresa_id;

  perform public.recalcular_totales_cotizacion(v_antes.cotizacion_id);

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes
  )
  values (
    v_empresa_id,
    v_user_id,
    'cotizacion_items',
    p_item_id,
    'eliminar_item_cotizacion',
    to_jsonb(v_antes)
  );

  return query select v_antes.id, v_antes.cotizacion_id;
end;
$$;

create or replace function public.cambiar_estado_cotizacion(
  p_cotizacion_id uuid,
  p_estado text
)
returns table (
  cotizacion_id uuid,
  numero text,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.cotizaciones%rowtype;
  v_despues public.cotizaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_estado not in ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida', 'anulada') then
    raise exception 'Estado de cotizacion invalido.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('quotes.status.change') then
    raise exception 'Permiso quotes.status.change requerido.' using errcode = '42501';
  end if;

  select c.* into v_antes
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if not (
    (v_antes.estado = 'borrador' and p_estado in ('enviada', 'anulada'))
    or (v_antes.estado = 'enviada' and p_estado in ('aceptada', 'rechazada', 'vencida', 'anulada'))
    or (v_antes.estado = p_estado)
  ) then
    raise exception 'Transicion de estado no permitida.' using errcode = '22023';
  end if;

  update public.cotizaciones as c
  set
    estado = p_estado,
    actualizado_por = v_user_id
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id
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
    'cotizaciones',
    p_cotizacion_id,
    'cambiar_estado_cotizacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.numero, v_despues.estado;
end;
$$;

revoke all on function public.recalcular_totales_cotizacion(uuid) from public;
revoke all on function public.crear_cotizacion(uuid, date, text, text, text, jsonb) from public;
revoke all on function public.actualizar_cotizacion(uuid, uuid, date, text, text, text) from public;
revoke all on function public.agregar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric) from public;
revoke all on function public.actualizar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric) from public;
revoke all on function public.eliminar_item_cotizacion(uuid) from public;
revoke all on function public.cambiar_estado_cotizacion(uuid, text) from public;

grant execute on function public.crear_cotizacion(uuid, date, text, text, text, jsonb) to authenticated;
grant execute on function public.actualizar_cotizacion(uuid, uuid, date, text, text, text) to authenticated;
grant execute on function public.agregar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.actualizar_item_cotizacion(uuid, text, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.eliminar_item_cotizacion(uuid) to authenticated;
grant execute on function public.cambiar_estado_cotizacion(uuid, text) to authenticated;
