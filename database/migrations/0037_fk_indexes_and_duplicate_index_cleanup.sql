-- FK index coverage and exact duplicate index cleanup.
-- Does not remove indexes only marked as unused by the advisor.

create index if not exists auditoria_eventos_usuario_empresa_idx
  on public.auditoria_eventos (usuario_id, empresa_id);
create index if not exists auditoria_eventos_sucursal_empresa_idx
  on public.auditoria_eventos (sucursal_id, empresa_id);

create index if not exists autoblog_articles_approved_by_idx
  on public.autoblog_articles (approved_by);
create index if not exists autoblog_articles_created_by_idx
  on public.autoblog_articles (created_by);
create index if not exists autoblog_articles_updated_by_idx
  on public.autoblog_articles (updated_by);
create index if not exists autoblog_topics_created_by_idx
  on public.autoblog_topics (created_by);

create index if not exists business_context_created_by_idx
  on public.business_context (created_by);
create index if not exists business_context_updated_by_idx
  on public.business_context (updated_by);

create index if not exists catalogo_categorias_created_by_empresa_idx
  on public.catalogo_categorias (created_by, empresa_id);
create index if not exists catalogo_categorias_updated_by_empresa_idx
  on public.catalogo_categorias (updated_by, empresa_id);
create index if not exists catalogo_productos_categoria_empresa_idx
  on public.catalogo_productos (categoria_id, empresa_id);
create index if not exists catalogo_productos_created_by_empresa_idx
  on public.catalogo_productos (created_by, empresa_id);
create index if not exists catalogo_productos_updated_by_empresa_idx
  on public.catalogo_productos (updated_by, empresa_id);

create index if not exists cotizacion_items_cotizacion_empresa_idx
  on public.cotizacion_items (cotizacion_id, empresa_id);
create index if not exists cotizacion_items_producto_empresa_idx
  on public.cotizacion_items (producto_id, empresa_id);
create index if not exists cotizaciones_actualizado_por_empresa_idx
  on public.cotizaciones (actualizado_por, empresa_id);
create index if not exists cotizaciones_cliente_empresa_idx
  on public.cotizaciones (cliente_id, empresa_id);
create index if not exists cotizaciones_creado_por_empresa_idx
  on public.cotizaciones (creado_por, empresa_id);

create index if not exists crm_clientes_asignado_empresa_idx
  on public.crm_clientes (asignado_a, empresa_id);
create index if not exists crm_clientes_created_by_empresa_idx
  on public.crm_clientes (created_by, empresa_id);
create index if not exists crm_clientes_updated_by_empresa_idx
  on public.crm_clientes (updated_by, empresa_id);
create index if not exists crm_interacciones_cliente_empresa_idx
  on public.crm_interacciones (cliente_id, empresa_id);
create index if not exists crm_interacciones_created_by_empresa_idx
  on public.crm_interacciones (created_by, empresa_id);
create index if not exists crm_seguimientos_asignado_empresa_idx
  on public.crm_seguimientos (asignado_a, empresa_id);
create index if not exists crm_seguimientos_cliente_empresa_idx
  on public.crm_seguimientos (cliente_id, empresa_id);
create index if not exists crm_seguimientos_created_by_empresa_idx
  on public.crm_seguimientos (created_by, empresa_id);
create index if not exists crm_seguimientos_updated_by_empresa_idx
  on public.crm_seguimientos (updated_by, empresa_id);

create index if not exists despachos_actualizado_por_empresa_idx
  on public.despachos (actualizado_por, empresa_id);
create index if not exists despachos_creado_por_empresa_idx
  on public.despachos (creado_por, empresa_id);
create index if not exists despachos_responsable_empresa_idx
  on public.despachos (responsable_id, empresa_id);
create index if not exists driver_live_status_current_dispatch_empresa_idx
  on public.driver_live_status (current_dispatch_id, empresa_id);
create index if not exists driver_live_status_current_dispatch_id_idx
  on public.driver_live_status (current_dispatch_id);

create index if not exists facturas_electronicas_cliente_id_idx
  on public.facturas_electronicas (cliente_id);

create index if not exists inbox_canal_secretos_created_by_empresa_idx
  on public.inbox_canal_secretos (created_by, empresa_id);
create index if not exists inbox_canal_secretos_updated_by_empresa_idx
  on public.inbox_canal_secretos (updated_by, empresa_id);
create index if not exists inbox_canales_created_by_empresa_idx
  on public.inbox_canales (created_by, empresa_id);
create index if not exists inbox_canales_updated_by_empresa_idx
  on public.inbox_canales (updated_by, empresa_id);
create index if not exists inbox_conversaciones_canal_empresa_idx
  on public.inbox_conversaciones (canal_id, empresa_id);
create index if not exists inbox_conversaciones_created_by_empresa_idx
  on public.inbox_conversaciones (created_by, empresa_id);
create index if not exists inbox_conversaciones_updated_by_empresa_idx
  on public.inbox_conversaciones (updated_by, empresa_id);
create index if not exists inbox_eventos_created_by_empresa_idx
  on public.inbox_eventos (created_by, empresa_id);
create index if not exists inbox_mensajes_enviado_por_empresa_idx
  on public.inbox_mensajes (enviado_por, empresa_id);

create index if not exists inventario_bodegas_created_by_empresa_idx
  on public.inventario_bodegas (created_by, empresa_id);
create index if not exists inventario_bodegas_updated_by_empresa_idx
  on public.inventario_bodegas (updated_by, empresa_id);
create index if not exists inventario_movimientos_created_by_empresa_idx
  on public.inventario_movimientos (created_by, empresa_id);

create index if not exists invitaciones_usuarios_aceptada_por_empresa_idx
  on public.invitaciones_usuarios (aceptada_por, empresa_id);
create index if not exists invitaciones_usuarios_invitado_por_empresa_idx
  on public.invitaciones_usuarios (invitado_por, empresa_id);
create index if not exists invitaciones_usuarios_rol_empresa_idx
  on public.invitaciones_usuarios (rol_id, empresa_id);
create index if not exists invitaciones_usuarios_sucursal_empresa_idx
  on public.invitaciones_usuarios (sucursal_id, empresa_id);

create index if not exists profiles_rol_empresa_idx
  on public.profiles (rol_id, empresa_id);
create index if not exists profiles_sucursal_empresa_idx
  on public.profiles (sucursal_id, empresa_id);

create index if not exists rrhh_planilla_estados_actualizado_por_empresa_idx
  on public.rrhh_planilla_estados (actualizado_por, empresa_id);
create index if not exists rrhh_planilla_estados_creado_por_empresa_idx
  on public.rrhh_planilla_estados (creado_por, empresa_id);
create index if not exists rrhh_planilla_eventos_creado_por_empresa_idx
  on public.rrhh_planilla_eventos (creado_por, empresa_id);
create index if not exists rrhh_planilla_eventos_estado_empresa_idx
  on public.rrhh_planilla_eventos (estado_id, empresa_id);

create index if not exists user_notifications_actor_profile_id_idx
  on public.user_notifications (actor_profile_id);

create index if not exists ventas_actualizado_por_empresa_idx
  on public.ventas (actualizado_por, empresa_id);
create index if not exists ventas_creado_por_empresa_idx
  on public.ventas (creado_por, empresa_id);
create index if not exists ventas_inventario_aplicado_por_empresa_idx
  on public.ventas (inventario_aplicado_por, empresa_id);

drop policy if exists catalogo_productos_select_inventory_permission on public.catalogo_productos;
drop policy if exists catalogo_productos_select_permission on public.catalogo_productos;
create policy catalogo_productos_select_permission
on public.catalogo_productos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('catalog.products.view')
    or public.current_user_has_permission('catalog.products.create')
    or public.current_user_has_permission('catalog.products.edit')
    or (
      tipo = 'producto'
      and (
        public.current_user_has_permission('inventory.stock.view')
        or public.current_user_has_permission('inventory.stock.adjust')
      )
    )
  )
);

drop policy if exists inventario_bodegas_select_permission on public.inventario_bodegas;
drop policy if exists inventario_bodegas_select_sales_inventory_permission on public.inventario_bodegas;
create policy inventario_bodegas_select_permission
on public.inventario_bodegas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inventory.warehouses.view')
    or public.current_user_has_permission('inventory.warehouses.manage')
    or (
      estado = 'activa'
      and public.current_user_has_permission('inventory.stock.adjust')
    )
  )
);

drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_users_admin on public.profiles;
create policy profiles_select_permission
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or (
    empresa_id = public.current_empresa_id()
    and (
      public.current_user_has_permission('admin.users.view')
      or public.current_user_has_permission('admin.users.manage')
    )
  )
);

drop policy if exists rol_permisos_select_current_role on public.rol_permisos;
drop policy if exists rol_permisos_select_roles_admin on public.rol_permisos;
create policy rol_permisos_select_permission
on public.rol_permisos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    rol_id = (
      select p.rol_id
      from public.profiles as p
      where p.id = auth.uid()
        and p.estado = 'activo'
      limit 1
    )
    or public.current_user_has_permission('admin.roles.view')
    or public.current_user_has_permission('admin.roles.manage')
  )
);

drop index if exists public.rrhh_planilla_estados_id_empresa_unique_idx;
drop index if exists public.rrhh_planilla_eventos_empresa_registrado_idx;
