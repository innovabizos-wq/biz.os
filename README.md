# biz.os

biz.os es un sistema operativo empresarial SaaS, multiempresa, modular y
preparado para crecer con nuevas capacidades sobre una base de permisos, RLS y
flujos operativos.

El MVP actual incluye Auth, empresas, usuarios, roles, permisos, Dashboard, CRM,
Nueva consulta, Agenda, Cotizaciones, Catalogo, Ventas, Inventario, Despacho con
mapa real, RRHH Planillas, Contexto del negocio, Autoblog MVP y notificaciones
persistentes por usuario. Facturacion real completa, compras/proveedores, IA
operativa, WhatsApp real avanzado, publicacion automatica y app movil quedan
fuera de esta fase.

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
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
PUBLIC_SIGNUP_ENABLED=true
FISCAL_CONFIG_ENCRYPTION_KEY=
HACIENDA_ENVIRONMENT=pruebas
HACIENDA_TEST_AUTH_URL=
HACIENDA_PROD_AUTH_URL=
HACIENDA_TEST_API_URL=
HACIENDA_PROD_API_URL=
BILLING_XML_VALIDATION_ENABLED=false
BILLING_XADES_SIGNING_ENABLED=false
BILLING_HACIENDA_SEND_ENABLED=false
BILLING_PDF_ENABLED=false
META_WEBHOOK_SKIP_SIGNATURE=false
META_WEBHOOK_DEBUG_LOGS=false
META_GRAPH_API_VERSION=v25.0
WHAPP_CAMPAIGN_WORKER_SECRET=
CRON_SECRET=
WHAPP_EMAIL_INBOUND_SECRET=
```

No incluir claves reales en `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` es
server-only: se lee solo desde `src/lib/supabase/admin.ts`, marcado
`server-only`. Sus imports deben permanecer allowlistados; cualquier server
action que lo use debe validar usuario, empresa y permiso antes de llamar una
RPC reservada a `service_role`.

`NEXT_PUBLIC_APP_URL` se usa para construir enlaces de invitacion. Si queda
vacia, biz.os genera rutas relativas.

Facturacion electronica no debe considerarse lista para produccion hasta tener
XML 4.4 validado, firma XAdES-EPES real, envio/consulta Hacienda y respuesta
oficial persistida.

`PUBLIC_SIGNUP_ENABLED` controla el registro libre. Si no existe o esta en
`true`, `/signup` permite crear una cuenta para luego crear empresa en
`/onboarding`. Si esta en `false`, `/signup` solo permite continuar con
`invitation_token`; sin invitacion muestra que el registro publico no esta
disponible.

## Comandos

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

Antes de una demo seria, entrega o despliegue usar:

```text
docs/release-checklist.md
```

## Estado MVP

La fase de consolidacion MVP esta documentada en:

```text
docs/modules/mvp-consolidation.md
```

Rutas principales para demo:

```text
/dashboard
/consultas/nueva
/crm/clientes
/agenda
/cotizaciones
/ventas
/inventario
/despacho
/rrhh/planillas/dashboard
/admin/fiscal
/admin/contexto
/autoblog
```

Modulos listos para demo controlada:

- Dashboard con KPIs reales disponibles.
- Nueva consulta, CRM, Agenda, Cotizaciones, Ventas, Inventario y Despacho.
- RRHH/Planillas y notificaciones por usuario.
- Contexto del negocio transversal y Autoblog MVP para borradores, revision,
  aprobacion y contenido listo para publicar manualmente.

Modulos en desarrollo o no listos para venta:

- Facturacion electronica real: falta XAdES-EPES, XML firmado, envio y consulta Hacienda.
- Whapp/Inbox real extremo a extremo: requiere credenciales Meta y prueba operacional.
- Autoblog futuro: publicacion automatica, WordPress/sitio web, redes sociales,
  programacion automatica y cron de 3 a 5 articulos diarios.
- Compras/proveedores, pagos/cuentas por cobrar, IA operativa, Business Brain,
  Agent Executor, Autopilot y app movil.

Migraciones recientes que pueden requerir aplicacion manual en Supabase dev:

```text
database/migrations/0020_user_notifications.sql
database/migrations/0022_inbox_meta_reliability_send.sql
database/migrations/0023_whapp_core_status_crm_link.sql
database/migrations/0027_roles_estandar_empresa.sql
database/migrations/0029_fiscal_commercial_flow.sql
database/migrations/0030_quotes_edit_until_sale.sql
database/migrations/0031_business_context.sql
database/migrations/0032_autoblog.sql
database/migrations/0033_company_modules_management.sql
database/migrations/0034_platform_module_contract.sql
```

No ejecutar migraciones desde la aplicacion. `SUPABASE_SERVICE_ROLE_KEY` queda
reservado para rutas backend sin sesion de usuario, como webhooks externos.

## Modulos Activos Por Empresa

`/admin/modulos` permite activar o desactivar modulos para la empresa actual.
La pantalla usa RPCs seguras que resuelven `empresa_id` server-side; el frontend
solo envia `moduloId` y el proximo estado (`activo` o `inactivo`).

La regla de acceso modular es:

```text
modulo activo para la empresa + permiso del usuario = acceso
```

`modulos` es el catalogo global, `empresa_modulos` es la activacion por empresa
y los permisos son el acceso por usuario. El modulo activo no reemplaza
permisos, y los permisos no reemplazan un modulo inactivo.

Modulos madre actuales: `admin`, `crm`, `agenda`, `quotes`, `catalog`, `sales`,
`inventory`, `dispatch` y `hr`. Se consideran siempre activos, aparecen como
bloqueados en `/admin/modulos` y la RPC tambien impide desactivarlos aunque se
intente llamar manualmente.

Modulos opcionales actuales: `billing`, `whapp`, `reports`, `ai`, `autoblog`,
`purchases`, `payments` y `mobile`. Cuando un modulo opcional esta inactivo no
debe aparecer en la barra lateral y las rutas principales bloqueadas muestran
que el modulo no esta activo para la empresa.

El contrato tecnico de modulos vive en
`src/modules/platform-modules/module-catalog.ts`: codigo, nombre, tipo, rutas,
permisos requeridos, configuracion requerida, claves de salud y dependencias
blandas. No se debe duplicar esta politica en pantallas individuales.

## Contexto Del Negocio

`/admin/contexto` define la identidad, reglas y conocimiento base que biz.os
usara para asistir a la empresa. Es transversal: no pertenece a Autoblog y puede
alimentar IA, WhatsApp/Inbox, cotizaciones, reportes y automatizaciones futuras.

Documento tecnico:

```text
docs/modules/business-context.md
```

## Business Brain

Business Brain es la arquitectura conceptual futura para convertir datos
operativos y `business_context` en insights, recomendaciones y planes por
empresa. No esta implementado todavia: no tiene migraciones, rutas, UI,
permisos, Agent Executor ni Autopilot.

La regla base es: si puede resolverse con logica, no usar IA. El Core Operativo
mantiene calculos, permisos, RLS, estados, validaciones, inventario, pagos y
reglas deterministicas. El Brain queda para interpretacion, patrones, riesgos,
priorizacion y recomendaciones explicables.

Autopilot no debe construirse antes del Brain. Primero se requiere entender el
negocio, clasificar niveles de riesgo, auditar recomendaciones y separar
sugerencia, aprobacion y ejecucion futura.

Documento conceptual:

```text
docs/architecture/business-brain.md
```

## Autoblog

Autoblog es un modulo principal de la barra lateral, no una seccion Marketing.
Usa `business_context` para crear articulos, guardar borradores, revisar,
aprobar, dejar contenido listo para publicar manualmente y preparar copys para
redes.

Rutas:

```text
/autoblog
/autoblog/nuevo
/autoblog/[articleId]
```

En el MVP no publica en internet, WordPress ni redes sociales. Tampoco ejecuta
cron, scraping ni busqueda web desde frontend. La publicacion automatica,
conexiones sociales y generacion diaria quedan para fases futuras.

Autoblog se activa por empresa desde `/admin/modulos`. No se debe activar con
SQL manual por cliente.

Documento tecnico:

```text
docs/modules/autoblog.md
```

## Whapp

Whapp es el centro operativo WhatsApp de biz.os. La primera fase reutiliza el
Inbox existente para conversaciones, canales Meta, webhook, diagnostico, envio
manual real, asignacion, notas internas y vinculo CRM basico.

Rutas principales:

```text
/whapp
/whapp/conversaciones
/whapp/canales
/whapp/salud
/whapp/reportes
```

Antes de probar estados Meta y vinculo CRM automatico por telefono, aplicar
manualmente la migracion local correspondiente. No se ejecuta automaticamente:

```text
database/migrations/0023_whapp_core_status_crm_link.sql
```

Documento tecnico:

```text
docs/modules/whapp-core.md
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

El Inbox principal queda preparado para recibir webhooks Meta y enviar mensajes
WhatsApp reales solamente cuando un usuario presiona enviar desde una
conversacion WhatsApp Meta configurada. No hay respuestas automaticas ni IA.

Para robustecer webhooks y envio manual, aplicar manualmente:

```text
database/migrations/0022_inbox_meta_reliability_send.sql
```

Documento tecnico:

```text
docs/modules/inbox-widget.md
docs/modules/inbox-meta-webhooks.md
```

## RRHH / Planillas

Planillas registra estados laborales diarios por usuario y empresa. Incluye un
widget compacto en el sidebar, estados configurables por empresa, registro
seguro por RPC y un dashboard operativo separado del dashboard general.

Rutas:

```text
/rrhh/personal
/rrhh/personal/nuevo
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

El frontend no envia `empresa_id`. `SUPABASE_SERVICE_ROLE_KEY` no se usa en el
flujo de onboarding.

Flujo para empresa nueva:

```text
/signup -> /onboarding -> /dashboard
```

`/onboarding` crea una empresa nueva. Si el usuario recibio una invitacion, debe
usar el enlace de invitacion y no este formulario.

Si existe una cookie `bizos_pending_invitation_token`, `/onboarding` redirige a
`/invitation` y no permite crear una empresa nueva por error.

Al crear empresa, `bootstrap_empresa_inicial` crea roles estandar y asigna al
fundador como `Super Admin`. Antes de probar esa mejora, aplicar manualmente:

```text
database/migrations/0027_roles_estandar_empresa.sql
```

Roles creados:

```text
Super Admin
Administrador
Supervisor
Vendedor
Servicio al cliente
Bodeguero
Chofer / Repartidor
Contabilidad / Facturacion
RRHH
```

`Super Admin` es un rol interno de la empresa cliente, equivalente conceptual a
Tenant Owner/Company Admin. No representa Platform Admin de AInovaCR ni concede
acceso global a otras empresas.

Documento tecnico:

```text
docs/modules/roles-defaults.md
docs/platform-operator-model.md
```

## Administración Base

Despues del onboarding, `/admin` muestra en solo lectura el nucleo multiempresa:
empresa, usuario, sucursal, rol, permisos, modulos activos y plan.

## Platform Console

`/platform` es una consola interna para AInovaCR/biz.os. No reemplaza `/admin`:

- `/admin` pertenece al cliente y opera dentro de su tenant.
- `/platform` pertenece al operador SaaS y requiere registro activo en
  `platform_users`.
- `Super Admin` sigue siendo rol interno del tenant, no Platform Admin global.

Para habilitar el primer operador SaaS, insertar manualmente el `profile_id`:

```sql
insert into public.platform_users (profile_id, role, notes)
values ('PROFILE_ID_AQUI', 'owner', 'Primer Platform Admin');
```

No se asigna Platform Admin automaticamente. La migracion local de base es:

```text
database/migrations/0050_platform_console.sql
```

Whapp sigue el modelo proveedor administrado: el cliente usa su numero asignado;
AInovaCR/biz.os administra la configuracion tecnica de Meta.

Tambien existen vistas de lectura para `/admin/usuarios`, `/admin/roles` y
`/admin/permisos`.

`/admin/invitaciones` y `/rrhh/personal/nuevo` muestran la experiencia
"Agregar personal". El admin captura nombre, cedula/identificacion, telefono,
correo, rol, sucursal y cargo opcional. No crea usuarios manualmente, no ve
contrasenas y no genera contrasenas temporales; genera un enlace
`/invitation?token=...` para que el colaborador cree su propia cuenta o inicie
sesion con Supabase Auth.
Antes de usarlo en Supabase dev, aplicar manualmente:

```text
database/migrations/0003_invitaciones_usuarios.sql
database/migrations/0026_personal_invitations_flow.sql
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

Documento tecnico:

```text
docs/modules/users-invitations.md
```

`/admin/roles`, `/admin/roles/nuevo` y `/admin/roles/[rolId]` permiten
administrar roles basicos y asignar permisos existentes. Antes de usar esa fase,
aplicar manualmente:

```text
database/migrations/0004_roles_admin.sql
```

La UI no crea permisos nuevos ni edita el catalogo global de permisos.
Si faltan roles estandar, `/admin/roles` muestra "Instalar roles estandar"; la
RPC usa `current_empresa_id()` y no acepta `empresa_id`.

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

El boton Cotizar guarda la gestion y abre `/cotizaciones/nueva?clienteId=...`
con el cliente creado o existente.

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

Incluye items manuales/catalogo, totales calculados y confirmacion de venta. En
el MVP no se guardan cotizaciones vacias: se crea la cotizacion solo con al
menos un item valido. La confirmacion genera la venta base; PDF, correo,
facturacion fiscal y salida de inventario se manejan desde sus modulos
correspondientes. Antes de usarlo, aplicar manualmente:

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

Una cotizacion confirmada puede generar una venta/orden que congela cliente,
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

Inbox es la bandeja centralizada para conversaciones de WhatsApp, Facebook
Messenger, Instagram DM y canal manual:

```text
/inbox
/inbox/conversaciones
/inbox/conversaciones/[conversacionId]
/inbox/canales
```

Incluye canales manuales, conversaciones, mensajes entrantes, respuestas
manuales, notas internas, asignacion, vinculacion a clientes CRM y estados. Con
canales Meta configurados, los webhooks oficiales reciben mensajes reales y
WhatsApp permite envio manual real desde conversaciones habilitadas. IA,
plantillas oficiales y automatizaciones avanzadas quedan fuera del nucleo base.
Antes de usarlo, aplicar manualmente:

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
y preparar el webhook sugerido. El frontend solo muestra estados de
configuracion; los secretos se leen server-side. Antes de usarlo, aplicar
manualmente:

```text
database/migrations/0018_inbox_meta_channels.sql
```

Los webhooks oficiales base de Meta quedan expuestos en:

```text
GET /api/webhooks/meta
POST /api/webhooks/meta
```

Permiten verificar `verify_token`, recibir payloads entrantes, crear o actualizar
conversaciones y guardar mensajes entrantes en Inbox. El envio manual real por
WhatsApp usa la configuracion segura del canal; plantillas y automatizaciones no
forman parte de este bloque. Antes de usarlo, aplicar manualmente:

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
Nueva consulta -> Cotizacion con items -> Confirmar venta -> Orden de venta -> Inventario -> Despacho
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
