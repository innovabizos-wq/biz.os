-- biz.os core global catalog seed.
-- No companies, users, or operational data are created here.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values
  ('admin', 'Administracion', 'Nucleo administrativo de empresa.', 'activo', 10),
  ('crm', 'CRM', 'Clientes, prospectos y seguimiento comercial.', 'activo', 20),
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

insert into public.planes (codigo, nombre, descripcion, precio_base, estado, limites)
values
  (
    'starter',
    'Starter',
    'Plan inicial para operar el nucleo administrativo y preparar CRM.',
    0,
    'activo',
    '{"usuarios": 5, "sucursales": 1}'::jsonb
  ),
  (
    'pro',
    'Pro',
    'Plan para operaciones comerciales con modulos avanzados.',
    0,
    'activo',
    '{"usuarios": 25, "sucursales": 5}'::jsonb
  ),
  (
    'enterprise',
    'Enterprise',
    'Plan empresarial con limites personalizados e integraciones futuras.',
    0,
    'activo',
    '{"usuarios": null, "sucursales": null}'::jsonb
  )
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  precio_base = excluded.precio_base,
  estado = excluded.estado,
  limites = excluded.limites;

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('admin.users.view', 'Ver usuarios', 'Permite consultar usuarios de la empresa.', 'admin', 'activo'),
  ('admin.users.manage', 'Gestionar usuarios', 'Permite administrar usuarios de la empresa.', 'admin', 'activo'),
  ('admin.roles.view', 'Ver roles', 'Permite consultar roles y permisos.', 'admin', 'activo'),
  ('admin.roles.manage', 'Gestionar roles', 'Permite administrar roles y permisos.', 'admin', 'activo'),
  ('admin.settings.view', 'Ver configuracion', 'Permite consultar configuracion de empresa.', 'admin', 'activo'),
  ('admin.settings.manage', 'Gestionar configuracion', 'Permite administrar configuracion de empresa.', 'admin', 'activo'),
  ('crm.customers.view', 'Ver clientes', 'Permite consultar clientes futuros del CRM.', 'crm', 'activo'),
  ('crm.customers.create', 'Crear clientes', 'Permite crear clientes futuros del CRM.', 'crm', 'activo'),
  ('sales.quotes.view', 'Ver cotizaciones', 'Permite consultar cotizaciones futuras.', 'sales', 'activo'),
  ('sales.quotes.create', 'Crear cotizaciones', 'Permite crear cotizaciones futuras.', 'sales', 'activo'),
  ('inventory.products.view', 'Ver productos', 'Permite consultar productos futuros.', 'inventory', 'activo'),
  ('dispatch.orders.view', 'Ver despachos', 'Permite consultar ordenes futuras de despacho.', 'dispatch', 'activo'),
  ('hr.timesheets.view', 'Ver planillas', 'Permite consultar planillas de RRHH.', 'hr', 'activo'),
  ('hr.timesheets.manage', 'Gestionar planillas', 'Permite gestionar la operacion diaria de planillas.', 'hr', 'activo'),
  ('hr.timesheets.register', 'Registrar estado laboral', 'Permite registrar estados laborales propios.', 'hr', 'activo'),
  ('hr.timesheets.dashboard', 'Ver dashboard de planillas', 'Permite ver el dashboard operativo de planillas.', 'hr', 'activo'),
  ('hr.timesheets.states.manage', 'Gestionar estados de planilla', 'Permite crear, editar y activar estados laborales.', 'hr', 'activo'),
  ('reports.dashboard.view', 'Ver dashboards', 'Permite consultar dashboards futuros.', 'reports', 'activo'),
  ('ai.reports.use', 'Usar reportes IA', 'Permite usar reportes futuros asistidos por IA.', 'ai', 'activo'),
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
