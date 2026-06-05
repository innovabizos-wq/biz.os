-- Platform module contract and locked core modules.
-- Apply manually in Supabase SQL Editor. Do not run from the app.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values
  ('admin', 'Administracion', 'Nucleo administrativo, empresa, roles, permisos y modulos.', 'activo', 10),
  ('crm', 'CRM', 'Clientes, prospectos, interacciones y seguimiento comercial.', 'activo', 20),
  ('agenda', 'Agenda', 'Agenda comercial basada en seguimientos y compromisos.', 'activo', 25),
  ('quotes', 'Cotizaciones', 'Cotizaciones, items comerciales y conversion a venta.', 'activo', 30),
  ('catalog', 'Catalogo', 'Catalogo comercial de productos, servicios y categorias.', 'activo', 35),
  ('sales', 'Ventas', 'Ventas, ordenes y puente hacia inventario, despacho y cobro.', 'activo', 40),
  ('inventory', 'Inventario', 'Bodegas, stock, movimientos, entradas y traslados.', 'activo', 50),
  ('dispatch', 'Despacho', 'Despacho, logistica, entregas y choferes en vivo.', 'activo', 60),
  ('hr', 'RRHH', 'Personal, planillas, estados laborales y dashboard RRHH.', 'activo', 70),
  ('billing', 'Facturacion', 'Configuracion fiscal y facturacion electronica Hacienda.', 'activo', 80),
  ('whapp', 'Whapp', 'Operacion WhatsApp/Meta sobre Inbox, webhooks y conversaciones.', 'activo', 90),
  ('reports', 'Reportes', 'Dashboards, reportes operativos y analitica transversal.', 'activo', 100),
  ('autoblog', 'Autoblog', 'Articulos, borradores, aprobacion y publicacion automatizable.', 'activo', 110),
  ('ai', 'IA', 'Asistencia operativa, analisis y uso del contexto del negocio.', 'activo', 120),
  ('purchases', 'Compras', 'Proveedores, ordenes de compra, recepcion y costos.', 'activo', 130),
  ('payments', 'Pagos', 'Pagos, cuentas por cobrar, saldos, abonos y vencimientos.', 'activo', 140),
  ('mobile', 'App Movil', 'Contratos de API para app movil, choferes y operacion ligera.', 'activo', 150)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  estado = excluded.estado,
  orden = excluded.orden;

update public.permisos
set modulo_codigo = 'quotes'
where codigo like 'quotes.%';

update public.permisos
set modulo_codigo = 'catalog'
where codigo like 'catalog.%';

update public.permisos
set modulo_codigo = 'whapp'
where codigo like 'inbox.%';

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('purchases.suppliers.view', 'Ver proveedores', 'Permite consultar proveedores.', 'purchases', 'activo'),
  ('purchases.suppliers.manage', 'Gestionar proveedores', 'Permite crear y editar proveedores.', 'purchases', 'activo'),
  ('purchases.orders.view', 'Ver ordenes de compra', 'Permite consultar ordenes de compra.', 'purchases', 'activo'),
  ('purchases.orders.manage', 'Gestionar ordenes de compra', 'Permite crear, editar y recibir ordenes de compra.', 'purchases', 'activo'),
  ('payments.accounts.view', 'Ver cuentas y pagos', 'Permite consultar cuentas por cobrar, cuentas por pagar y pagos.', 'payments', 'activo'),
  ('payments.accounts.manage', 'Gestionar cuentas y pagos', 'Permite registrar pagos, abonos y ajustes.', 'payments', 'activo'),
  ('mobile.access', 'Acceso app movil', 'Permite usar contratos de API movil habilitados para la empresa.', 'mobile', 'activo')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;

insert into public.empresa_modulos (empresa_id, modulo_id, estado, fecha_activacion, fecha_desactivacion, configuracion)
select
  e.id,
  m.id,
  'activo',
  now(),
  null,
  '{}'::jsonb
from public.empresas as e
cross join public.modulos as m
where m.codigo in ('admin', 'crm', 'agenda', 'quotes', 'catalog', 'sales', 'inventory', 'dispatch', 'hr')
on conflict on constraint empresa_modulos_empresa_modulo_unique
do update set
  estado = 'activo',
  fecha_desactivacion = null,
  configuracion = coalesce(public.empresa_modulos.configuracion, '{}'::jsonb);

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

  if v_next_state = 'inactivo'
    and v_modulo.codigo in ('admin', 'crm', 'agenda', 'quotes', 'catalog', 'sales', 'inventory', 'dispatch', 'hr') then
    raise exception 'Este modulo es madre de biz.os y no se puede desactivar.' using errcode = '42501';
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

revoke all on function public.cambiar_estado_modulo_empresa_actual(uuid, text) from public;
grant execute on function public.cambiar_estado_modulo_empresa_actual(uuid, text) to authenticated;
