-- Keep every biz.os module active from the first company session.
-- Modules can still require permissions, credentials or configuration, but new tenants should not start with disabled modules.

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
  ('billing', 'Facturacion', 'Facturacion electronica Costa Rica: fiscal, CABYS, documentos, XML y Hacienda.', 'activo', 80),
  ('whapp', 'Whapp', 'Operacion omnicanal Whapp sobre Inbox, webhooks, plantillas, campanas, automatizaciones y conversaciones.', 'activo', 90),
  ('reports', 'Reportes', 'Dashboards, reportes operativos y analitica transversal.', 'activo', 100),
  ('autoblog', 'Autoblog', 'Articulos, borradores, aprobacion y publicacion automatizable.', 'activo', 110),
  ('ai', 'IA', 'Asistencia operativa, analisis y uso del contexto del negocio.', 'activo', 120),
  ('purchases', 'Compras', 'Proveedores, ordenes de compra, recepcion y costos.', 'activo', 130),
  ('payments', 'Pagos', 'Pagos, cuentas por cobrar, saldos, abonos y vencimientos.', 'activo', 140),
  ('mobile', 'App Movil', 'Contratos de API para app movil, choferes y operacion ligera.', 'activo', 150),
  ('brain', 'Business Brain', 'Inteligencia transversal para metricas, insights y recomendaciones operativas.', 'activo', 160)
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  estado = excluded.estado,
  orden = excluded.orden;

create or replace function public.activar_todos_modulos_empresa(
  p_empresa_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.empresa_modulos (empresa_id, modulo_id, estado, fecha_activacion, fecha_desactivacion, configuracion)
  select
    p_empresa_id,
    m.id,
    'activo',
    now(),
    null,
    '{}'::jsonb
  from public.modulos as m
  where m.estado = 'activo'
  on conflict on constraint empresa_modulos_empresa_modulo_unique
  do update set
    estado = 'activo',
    fecha_activacion = case
      when public.empresa_modulos.estado = 'activo' then public.empresa_modulos.fecha_activacion
      else now()
    end,
    fecha_desactivacion = null,
    configuracion = coalesce(public.empresa_modulos.configuracion, '{}'::jsonb);
end;
$$;

revoke all on function public.activar_todos_modulos_empresa(uuid) from public;

select public.activar_todos_modulos_empresa(e.id)
from public.empresas as e;

create or replace function public.activar_todos_modulos_empresa_plan_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.activar_todos_modulos_empresa(new.empresa_id);
  return new;
end;
$$;

revoke all on function public.activar_todos_modulos_empresa_plan_trigger() from public;

drop trigger if exists empresa_plan_activar_todos_modulos on public.empresa_plan;
create trigger empresa_plan_activar_todos_modulos
after insert on public.empresa_plan
for each row
execute function public.activar_todos_modulos_empresa_plan_trigger();
