insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values ('billing', 'Facturacion', 'Facturacion electronica y configuracion fiscal.', 'activo', 50)
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    estado = excluded.estado,
    orden = excluded.orden;

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('billing.fiscal.view', 'Ver configuracion fiscal', 'Permite ver el estado de configuracion fiscal de la empresa.', 'billing', 'activo'),
  ('billing.fiscal.manage', 'Gestionar configuracion fiscal', 'Permite actualizar credenciales y datos fiscales de la empresa.', 'billing', 'activo'),
  ('billing.invoices.view', 'Ver facturas electronicas', 'Permite ver facturas electronicas generadas desde ventas.', 'billing', 'activo'),
  ('billing.invoices.create', 'Emitir facturas electronicas', 'Permite crear y enviar facturas electronicas.', 'billing', 'activo')
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
    'billing.fiscal.view',
    'billing.fiscal.manage',
    'billing.invoices.view',
    'billing.invoices.create'
  )
where r.nombre in ('Administrador', 'Admin', 'Gerente')
on conflict (empresa_id, rol_id, permiso_id) do nothing;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in ('billing.invoices.view', 'billing.invoices.create')
where r.nombre in ('Vendedor', 'Ventas')
on conflict (empresa_id, rol_id, permiso_id) do nothing;

create table if not exists public.facturas_electronicas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  venta_id uuid references public.ventas(id) on delete set null,
  cliente_id uuid references public.crm_clientes(id) on delete set null,
  numero text not null,
  clave text,
  consecutivo text,
  estado text not null default 'borrador',
  ambiente text not null default 'pruebas',
  tipo_comprobante text not null default 'factura_electronica',
  moneda text not null default 'CRC',
  subtotal numeric(14, 2) not null default 0,
  descuento_total numeric(14, 2) not null default 0,
  impuesto_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  receptor_nombre text,
  receptor_identificacion text,
  receptor_tipo_identificacion text,
  receptor_correo text,
  condicion_venta text,
  medio_pago text,
  actividad_economica text,
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  xml_firmado_base64 text,
  respuesta_xml_base64 text,
  error_mensaje text,
  enviado_at timestamptz,
  aceptado_at timestamptz,
  rechazado_at timestamptz,
  creado_por uuid,
  actualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint facturas_electronicas_estado_check
    check (estado in ('borrador', 'firmando', 'enviada', 'aceptada', 'rechazada', 'error')),
  constraint facturas_electronicas_ambiente_check
    check (ambiente in ('pruebas', 'produccion')),
  constraint facturas_electronicas_tipo_check
    check (tipo_comprobante in ('factura_electronica', 'tiquete_electronico')),
  constraint facturas_electronicas_empresa_numero_unique unique (empresa_id, numero),
  constraint facturas_electronicas_venta_unique unique (empresa_id, venta_id)
);

create index if not exists facturas_electronicas_empresa_id_idx
  on public.facturas_electronicas (empresa_id);
create index if not exists facturas_electronicas_empresa_estado_idx
  on public.facturas_electronicas (empresa_id, estado);
create index if not exists facturas_electronicas_empresa_venta_idx
  on public.facturas_electronicas (empresa_id, venta_id);

alter table public.facturas_electronicas enable row level security;

grant select on public.facturas_electronicas to authenticated;

drop policy if exists facturas_electronicas_select_permission on public.facturas_electronicas;
create policy facturas_electronicas_select_permission
on public.facturas_electronicas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('billing.invoices.view')
    or public.current_user_has_permission('billing.invoices.create')
  )
);

create or replace function public.eliminar_cotizacion_segura(
  p_cotizacion_id uuid
)
returns table (cotizacion_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_cotizacion public.cotizaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('admin.settings.manage')
    or public.current_user_has_permission('admin.roles.manage')
  ) then
    raise exception 'Solo un administrador puede eliminar cotizaciones.' using errcode = '42501';
  end if;

  select c.* into v_cotizacion
  from public.cotizaciones as c
  where c.id = p_cotizacion_id
    and c.empresa_id = v_empresa_id;

  if v_cotizacion.id is null then
    raise exception 'Cotizacion no encontrada.' using errcode = '02000';
  end if;

  if exists (
    select 1
    from public.ventas as v
    where v.empresa_id = v_empresa_id
      and v.cotizacion_id = p_cotizacion_id
  ) then
    raise exception 'No se puede eliminar una cotizacion que ya tiene venta.' using errcode = '22023';
  end if;

  delete from public.cotizacion_items as i
  where i.empresa_id = v_empresa_id
    and i.cotizacion_id = p_cotizacion_id;

  delete from public.cotizaciones as c
  where c.empresa_id = v_empresa_id
    and c.id = p_cotizacion_id;

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
    'cotizaciones',
    p_cotizacion_id,
    'eliminar_cotizacion_segura',
    to_jsonb(v_cotizacion)
  );

  return query select p_cotizacion_id;
end;
$$;

create or replace function public.crear_factura_electronica_desde_venta(
  p_venta_id uuid,
  p_receptor_nombre text,
  p_receptor_identificacion text,
  p_receptor_tipo_identificacion text,
  p_receptor_correo text,
  p_condicion_venta text,
  p_medio_pago text,
  p_actividad_economica text,
  p_ambiente text default 'pruebas',
  p_tipo_comprobante text default 'factura_electronica'
)
returns table (factura_id uuid, numero text, estado text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_venta public.ventas%rowtype;
  v_factura public.facturas_electronicas%rowtype;
  v_numero text;
  v_seq integer;
  v_year text := to_char(current_date, 'YYYY');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('billing.invoices.create') then
    raise exception 'Permiso para emitir facturas requerido.' using errcode = '42501';
  end if;

  if p_ambiente not in ('pruebas', 'produccion') then
    raise exception 'Ambiente fiscal invalido.' using errcode = '22023';
  end if;

  if p_tipo_comprobante not in ('factura_electronica', 'tiquete_electronico') then
    raise exception 'Tipo de comprobante invalido.' using errcode = '22023';
  end if;

  select v.* into v_venta
  from public.ventas as v
  where v.id = p_venta_id
    and v.empresa_id = v_empresa_id;

  if v_venta.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_venta.estado not in ('confirmada', 'en_proceso', 'completada') then
    raise exception 'La venta debe estar confirmada antes de facturar.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.facturas_electronicas as f
    where f.empresa_id = v_empresa_id
      and f.venta_id = p_venta_id
      and f.estado <> 'error'
  ) then
    raise exception 'Ya existe una factura para esta venta.' using errcode = '23505';
  end if;

  select count(*)::integer + 1
  into v_seq
  from public.facturas_electronicas as f
  where f.empresa_id = v_empresa_id
    and f.numero like ('FAC-' || v_year || '-%');

  loop
    v_numero := 'FAC-' || v_year || '-' || lpad(v_seq::text, 6, '0');

    begin
      insert into public.facturas_electronicas (
        empresa_id,
        venta_id,
        cliente_id,
        numero,
        estado,
        ambiente,
        tipo_comprobante,
        moneda,
        subtotal,
        descuento_total,
        impuesto_total,
        total,
        receptor_nombre,
        receptor_identificacion,
        receptor_tipo_identificacion,
        receptor_correo,
        condicion_venta,
        medio_pago,
        actividad_economica,
        creado_por,
        actualizado_por
      )
      values (
        v_empresa_id,
        v_venta.id,
        v_venta.cliente_id,
        v_numero,
        'borrador',
        p_ambiente,
        p_tipo_comprobante,
        v_venta.moneda,
        v_venta.subtotal,
        v_venta.descuento_total,
        v_venta.impuesto_total,
        v_venta.total,
        nullif(btrim(coalesce(p_receptor_nombre, '')), ''),
        nullif(btrim(coalesce(p_receptor_identificacion, '')), ''),
        nullif(btrim(coalesce(p_receptor_tipo_identificacion, '')), ''),
        nullif(btrim(coalesce(p_receptor_correo, '')), ''),
        nullif(btrim(coalesce(p_condicion_venta, '')), ''),
        nullif(btrim(coalesce(p_medio_pago, '')), ''),
        nullif(btrim(coalesce(p_actividad_economica, '')), ''),
        v_user_id,
        v_user_id
      )
      returning * into v_factura;

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
    'facturas_electronicas',
    v_factura.id,
    'crear_factura_electronica_desde_venta',
    to_jsonb(v_factura)
  );

  return query select v_factura.id, v_factura.numero, v_factura.estado;
end;
$$;

revoke all on function public.eliminar_cotizacion_segura(uuid) from public;
revoke all on function public.crear_factura_electronica_desde_venta(uuid, text, text, text, text, text, text, text, text, text) from public;

grant execute on function public.eliminar_cotizacion_segura(uuid) to authenticated;
grant execute on function public.crear_factura_electronica_desde_venta(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
