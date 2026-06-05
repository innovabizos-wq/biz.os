-- Remaining FK index coverage reported after the first performance pass.
-- Keeps unused indexes intact; this migration only adds covering indexes.

create index if not exists despachos_cliente_empresa_idx
  on public.despachos (cliente_id, empresa_id);
create index if not exists despachos_venta_empresa_idx
  on public.despachos (venta_id, empresa_id);

create index if not exists driver_live_status_profile_empresa_idx
  on public.driver_live_status (profile_id, empresa_id);

create index if not exists facturas_electronicas_venta_id_idx
  on public.facturas_electronicas (venta_id);

create index if not exists inbox_canal_secretos_canal_empresa_idx
  on public.inbox_canal_secretos (canal_id, empresa_id);
create index if not exists inbox_conversaciones_asignado_empresa_idx
  on public.inbox_conversaciones (asignado_a, empresa_id);
create index if not exists inbox_conversaciones_cliente_empresa_idx
  on public.inbox_conversaciones (cliente_id, empresa_id);
create index if not exists inbox_eventos_conversacion_empresa_idx
  on public.inbox_eventos (conversacion_id, empresa_id);
create index if not exists inbox_mensajes_conversacion_empresa_idx
  on public.inbox_mensajes (conversacion_id, empresa_id);
create index if not exists inbox_webhook_eventos_canal_id_idx
  on public.inbox_webhook_eventos (canal_id);

create index if not exists inventario_movimientos_bodega_id_idx
  on public.inventario_movimientos (bodega_id);
create index if not exists inventario_movimientos_producto_id_idx
  on public.inventario_movimientos (producto_id);
create index if not exists inventario_stock_bodega_empresa_idx
  on public.inventario_stock (bodega_id, empresa_id);
create index if not exists inventario_stock_producto_empresa_idx
  on public.inventario_stock (producto_id, empresa_id);

create index if not exists rol_permisos_permiso_id_idx
  on public.rol_permisos (permiso_id);
create index if not exists rol_permisos_rol_empresa_idx
  on public.rol_permisos (rol_id, empresa_id);

create index if not exists rrhh_planilla_eventos_profile_empresa_idx
  on public.rrhh_planilla_eventos (profile_id, empresa_id);

create index if not exists user_notifications_recipient_profile_id_idx
  on public.user_notifications (recipient_profile_id);

create index if not exists venta_items_cotizacion_item_id_idx
  on public.venta_items (cotizacion_item_id);
create index if not exists venta_items_producto_id_idx
  on public.venta_items (producto_id);
create index if not exists venta_items_venta_empresa_idx
  on public.venta_items (venta_id, empresa_id);

create index if not exists ventas_cliente_empresa_idx
  on public.ventas (cliente_id, empresa_id);
create index if not exists ventas_cotizacion_empresa_idx
  on public.ventas (cotizacion_id, empresa_id);
