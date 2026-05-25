# biz.os

biz.os es la base de un sistema operativo empresarial SaaS, multiempresa,
modular y preparado para una capa de IA transversal futura.

Este entregable inicial crea solamente la base tecnica del proyecto. No incluye
CRM, ventas, inventario, despacho, facturacion, dashboards avanzados ni IA.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- PostgreSQL
- Supabase RLS
- Zod
- Vercel

TanStack Query queda como opcion futura y no forma parte del arranque.

## Vision Multiempresa

biz.os usa aislamiento fuerte por empresa. Cada empresa opera como un ecosistema
independiente: usuarios, clientes, productos, inventarios, facturas, reportes y
configuraciones no se comparten entre empresas.

El `empresa_id` es la frontera principal de seguridad para toda tabla sensible.
Un usuario operativo pertenece a una sola empresa y la empresa activa se debe
resolver desde Supabase Auth y `profiles`, no desde datos enviados libremente por
el frontend.

`profiles` significa perfil operativo del usuario autenticado.

## Variables De Entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
```

No incluir claves reales en `.env.example`. Las claves server-only, como una
posible service role futura, no deben exponerse al navegador ni usarse en
helpers de frontend.

`NEXT_PUBLIC_APP_URL` se usa para construir enlaces de invitacion. Si queda
vacia, biz.os genera rutas relativas.

## Comandos

```bash
npm run dev
npm run lint
npm run build
```

## Notificaciones Por Usuario

biz.os incluye una campana global de notificaciones persistentes por usuario.
Cada notificacion pertenece a una empresa y a un perfil destinatario especifico;
no son notificaciones generales compartidas.

La campana muestra contador de no leidas, ultimas notificaciones y acciones para
marcar una o todas como leidas. Nueva consulta crea una notificacion de exito al
guardar una gestion.

Antes de probarlo en Supabase dev, aplicar manualmente:

```text
database/migrations/0020_user_notifications.sql
```

Documento tecnico:

```text
docs/modules/user-notifications.md
```

## Widget Flotante De Inbox

El layout autenticado incluye un boton flotante verde de mensajeria sobre el
boton `+`. Abre una mini bandeja tipo WhatsApp con lista de conversaciones y
chat activo, conectada a conversaciones/mensajes existentes del Inbox.

No envia mensajes reales ni usa IA en esta fase.

Documento tecnico:

```text
docs/modules/inbox-widget.md
```

## RRHH / Planillas

Planillas registra estados laborales diarios por usuario y empresa. Incluye un
widget compacto en el sidebar, estados configurables por empresa, registro
seguro por RPC y un dashboard operativo separado del dashboard general.

Rutas:

```text
/rrhh/planillas
/rrhh/planillas/dashboard
/rrhh/planillas/estados
```

Permisos principales:

```text
hr.timesheets.view
hr.timesheets.manage
hr.timesheets.register
hr.timesheets.dashboard
hr.timesheets.states.manage
```

Antes de probarlo en Supabase dev, aplicar manualmente:

```text
database/migrations/0016b_rrhh_planillas_profesional.sql
```

Prueba sugerida: entrar como administrador, abrir `/rrhh/planillas/estados`,
inicializar estados base, activar/desactivar estados, registrar Login y Almuerzo
desde el sidebar, registrar Regreso de almuerzo y revisar
`/rrhh/planillas/dashboard`.

## Auth Y Onboarding Inicial

El flujo inicial usa Supabase Auth y una RPC local para crear la primera empresa:

```text
signup/login -> onboarding -> bootstrap_empresa_inicial -> dashboard
```

Antes de probar onboarding en Supabase dev, aplicar manualmente en SQL Editor:

```text
database/migrations/0002_bootstrap_empresa.sql
```

No se usa `SUPABASE_SERVICE_ROLE_KEY` y el frontend no envia `empresa_id`.

Flujo para empresa nueva:

```text
/signup -> /onboarding -> /dashboard
```

`/onboarding` crea una empresa nueva. Si el usuario recibio una invitacion, debe
usar el enlace de invitacion y no este formulario.

## Administración Base

Despues del onboarding, `/admin` muestra en solo lectura el nucleo multiempresa:
empresa, usuario, sucursal, rol, permisos, modulos activos y plan.

Tambien existen vistas de lectura para `/admin/usuarios`, `/admin/roles` y
`/admin/permisos`.

`/admin/invitaciones` permite crear invitaciones seguras para usuarios nuevos.
No crea usuarios manualmente ni envia correos todavia; genera un enlace
`/invitation?token=...` que el invitado acepta con una cuenta de Supabase Auth.
Antes de usarlo en Supabase dev, aplicar manualmente:

```text
database/migrations/0003_invitaciones_usuarios.sql
```

Flujo para usuario invitado:

```text
admin crea invitacion -> /invitation?token=... -> signup/login con el mismo correo -> aceptar invitacion -> /dashboard
```

El token se conserva como `invitation_token` en login/signup solo para volver al
flujo de invitacion. La empresa se resuelve y valida dentro de la RPC; no se
envia `empresa_id` desde frontend.

Durante signup con confirmacion de correo, biz.os guarda temporalmente el token
en una cookie httpOnly de navegacion. Despues de confirmar e iniciar sesion, el
usuario vuelve automaticamente a `/invitation?token=...` y no a `/onboarding`.

`/admin/roles`, `/admin/roles/nuevo` y `/admin/roles/[rolId]` permiten
administrar roles basicos y asignar permisos existentes. Antes de usar esa fase,
aplicar manualmente:

```text
database/migrations/0004_roles_admin.sql
```

La UI no crea permisos nuevos ni edita el catalogo global de permisos.

`/admin/usuarios` y `/admin/usuarios/[profileId]` permiten administrar usuarios
existentes de la empresa: datos basicos, rol, sucursal y estado. Los usuarios se
agregan por invitacion, no por creacion manual. Antes de usar esa fase, aplicar
manualmente:

```text
database/migrations/0006_users_admin.sql
```

## CRM Basico

El primer modulo operativo es CRM:

```text
/crm
/crm/clientes
/crm/clientes/nuevo
/crm/clientes/[clienteId]
```

Incluye clientes/prospectos, interacciones manuales y seguimientos basicos. No
integra WhatsApp real, llamadas reales, cotizaciones, ventas, inventario,
facturacion ni IA. Antes de usarlo, aplicar manualmente:

```text
database/migrations/0007_crm_core.sql
```

## Nueva Consulta

Desde el Dashboard, el boton principal abre:

```text
/consultas/nueva
```

El flujo busca primero en CRM por `crm_clientes.identificacion`. Si no existe,
consulta Hacienda Costa Rica en `/fe/ae`, precarga datos cuando hay resultado y
permite completar manualmente cuando no hay datos. Al guardar, vuelve a buscar
por documento para evitar duplicados y registra la gestion en
`crm_interacciones`.

El boton Cotizar guarda la gestion y queda preparado para conectar el flujo de
cotizaciones en una fase posterior.

## Agenda Operativa

La agenda usa los seguimientos existentes del CRM:

```text
/agenda
/agenda/seguimientos
```

Permite ver seguimientos de hoy, vencidos, proximos, completados recientes y
operarlos con acciones rapidas. No integra Google Calendar, WhatsApp real,
llamadas reales ni crea un calendario visual todavia. Antes de usarla, aplicar
manualmente:

```text
database/migrations/0008_crm_followups_agenda.sql
```

## Cotizaciones Básicas

Cotizaciones permite crear propuestas comerciales simples conectadas al CRM:

```text
/cotizaciones
/cotizaciones/nueva
/cotizaciones/[cotizacionId]
```

Incluye items manuales, totales calculados y estados comerciales. No genera PDF,
no envia correos, no crea ventas, no factura y no mueve inventario. Antes de
usarlo, aplicar manualmente:

```text
database/migrations/0009_cotizaciones_core.sql
```

## Catálogo Básico

Cada empresa puede mantener un catalogo comercial propio:

```text
/catalogo
/catalogo/productos
/catalogo/productos/nuevo
/catalogo/productos/[productoId]
/catalogo/categorias
```

Incluye productos, servicios, categorias, precio base, impuesto sugerido,
unidad de medida y estado. No administra inventario, stock, compras,
facturacion ni seleccion automatica en cotizaciones todavia. Antes de usarlo,
aplicar manualmente:

```text
database/migrations/0010_catalogo_productos.sql
```

## Conexión Catálogo Y Cotizaciones

Los items de cotizacion pueden vincularse opcionalmente a productos o servicios
activos del catalogo. La seleccion autollena descripcion, precio base e impuesto
sugerido, pero el item conserva precio historico y puede editarse manualmente.
Antes de usarlo, aplicar manualmente:

```text
database/migrations/0011_quotes_catalog_connection.sql
```

## Ventas / Ordenes Basicas

Una cotizacion aceptada puede generar una venta/orden que congela cliente,
cotizacion origen, items, precios y totales:

```text
/ventas
/ventas/[ventaId]
```

No factura, no cobra, no descuenta inventario y no despacha. Antes de usarlo,
aplicar manualmente:

```text
database/migrations/0012_ventas_core.sql
```

La salida de inventario desde una venta se aplica manualmente desde
`/ventas/[ventaId]`; no ocurre al generar ni confirmar la venta. Antes de usar
esa conexion, aplicar manualmente:

```text
database/migrations/0014_sales_inventory_connection.sql
```

## Despacho Básico

Despacho permite dar seguimiento operativo a entregas o trabajos derivados de
ventas:

```text
/despacho
/despacho/[despachoId]
```

Se crea desde `/ventas/[ventaId]` para ventas confirmadas, en proceso o
completadas. Incluye responsable, fecha/hora, direccion textual, contacto,
telefono, notas, resultado, estados operativos, panel superior de control,
mapa real con Leaflet/OpenStreetMap, resumen del dia y actividad reciente. No
incluye app movil, GPS desde celular, Google Maps, Waze, WebSockets,
historial pesado ni optimizacion de rutas en esta fase. Antes de usarlo,
aplicar manualmente:

```text
database/migrations/0015_despacho_core.sql
database/migrations/0017_driver_live_tracking.sql
```

## Inbox / Chat Unificado Base

Inbox prepara la bandeja centralizada para conversaciones de WhatsApp, Facebook
Messenger, Instagram DM y canal manual, sin integrar APIs reales de Meta en esta
fase:

```text
/inbox
/inbox/conversaciones
/inbox/conversaciones/[conversacionId]
/inbox/canales
```

Incluye canales manuales, conversaciones, mensajes simulados, notas internas,
asignacion, vinculacion a clientes CRM y estados. No crea webhooks, no envia
mensajes reales, no guarda tokens de Meta y no implementa IA. Antes de usarlo,
aplicar manualmente:

```text
database/migrations/0016_inbox_core.sql
```

La configuracion oficial de canales Meta agrega rutas de alta/control:

```text
/inbox/canales
/inbox/canales/nuevo
/inbox/canales/[canalId]
```

Permite registrar datos publicos de WhatsApp Business Cloud API, Facebook
Messenger e Instagram Messaging por empresa, guardar secretos en tabla privada
y preparar el webhook sugerido. No recibe webhooks ni envia mensajes reales.
Antes de usarlo, aplicar manualmente:

```text
database/migrations/0018_inbox_meta_channels.sql
```

Los webhooks oficiales base de Meta quedan expuestos en:

```text
GET /api/webhooks/meta
POST /api/webhooks/meta
```

Permiten verificar `verify_token`, recibir payloads entrantes, crear o actualizar
conversaciones y guardar mensajes entrantes en Inbox. No envia respuestas reales
ni implementa plantillas. Antes de usarlo, aplicar manualmente:

```text
database/migrations/0019_inbox_meta_webhooks.sql
```

## Inventario Básico Manual

Inventario permite manejar existencias manuales de productos fisicos del
catalogo:

```text
/inventario
/inventario/productos
/inventario/movimientos
/inventario/bodegas
```

Incluye bodegas, stock por producto/bodega, entradas, salidas, ajustes y
minimos/maximos. Los servicios no manejan inventario. No descuenta stock por
venta, no compra, no reserva y no despacha todavia. Antes de usarlo, aplicar
manualmente:

```text
database/migrations/0013_inventario_core.sql
```

## Estructura

```text
src/app             Rutas, layouts y composicion
src/modules         Logica por dominio del nucleo SaaS
src/components/ui   Componentes base de shadcn/ui
src/components/layout Estructura visual general
src/components/shared Componentes reutilizables no ligados a dominio
src/lib             Utilidades transversales internas
src/services        Integraciones externas futuras
src/database        Migraciones, policies, seeds y tipos
docs                Arquitectura y decisiones tecnicas
```

No se crean carpetas operativas futuras hasta que se implementen sus modulos.

## Reglas De Arquitectura

- `app/` solo contiene rutas, layouts y composicion.
- La logica de negocio vive fuera de `app/` y fuera de componentes visuales.
- Ningun componente visual llama APIs externas directamente.
- Ninguna mutacion operativa acepta `empresa_id` desde frontend como fuente
  confiable.
- Las tablas sensibles futuras deben incluir `empresa_id`.
- Los roles, modulos activos y planes se gestionan por empresa.
- El superadmin de plataforma no vive en `profiles` ni usa `empresa_id = null`.
- Para codigo de modulos activos se usa `platform-modules`, no
  `modules/modules`.

## Tamano De Archivos

- Objetivo normal: menos de 250 lineas.
- Revisar division al pasar de 300 lineas.
- Dividir cerca de 400 lineas salvo casos justificados, como tipos generados.

## Próximos Pasos

El flujo operativo actual ya cubre:

```text
Cliente -> Agenda -> Cotización -> Venta -> Inventario -> Despacho
```

Siguientes fases sugeridas, sin mezclar responsabilidades:

- Facturación y pagos.
- Compras y proveedores.
- Reservas de inventario.
- Rutas simples y pruebas de entrega.
- Reportes operativos.

Para desarrollo local:

```bash
npm run dev
npm run lint
npm run build
```
