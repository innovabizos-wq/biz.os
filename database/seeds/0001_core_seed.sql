-- biz.os core global catalog seed.
-- No companies, users, or operational data are created here.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values
  ('admin', 'Administracion', 'Nucleo administrativo de empresa.', 'activo', 10),
  ('crm', 'CRM', 'Clientes, prospectos y seguimiento comercial.', 'activo', 20),
  ('sales', 'Ventas', 'Cotizaciones, proformas y ventas.', 'activo', 30),
  ('inventory', 'Inventario', 'Productos, existencias y movimientos.', 'activo', 40),
  ('billing', 'Facturacion', 'Facturacion e integraciones fiscales.', 'activo', 50),
  ('dispatch', 'Despacho', 'Logistica, rutas y entregas.', 'activo', 60),
  ('hr', 'RRHH', 'Planillas, asistencia y estados diarios.', 'activo', 70),
  ('reports', 'Reportes', 'Dashboards y reportes operativos.', 'activo', 80),
  ('ai', 'IA', 'Analisis y asistencia transversal futura.', 'activo', 90)
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
  ('ai.reports.use', 'Usar reportes IA', 'Permite usar reportes futuros asistidos por IA.', 'ai', 'activo')
on conflict (codigo) do update set
  nombre = excluded.nombre,
  descripcion = excluded.descripcion,
  modulo_codigo = excluded.modulo_codigo,
  estado = excluded.estado;
