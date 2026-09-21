# Revision Operativa Real De Biz.OS

Fecha: 2026-07-14

## Objetivo

Esta revision separa tres cosas que antes se estaban mezclando:

1. Modulos de negocio visibles para la empresa.
2. Submodulos tecnicos internos del codigo.
3. Funcionalidad realmente operativa en la app desplegada.

La base canonica para contar modulos es [`PLATFORM_MODULES`](../../src/modules/platform-modules/module-catalog.ts), no el numero de carpetas en `src/modules`.

## Inventario Canonico

Biz.OS expone 18 modulos de plataforma:

| Codigo | Modulo | Tipo | Ruta base |
| --- | --- | --- | --- |
| `admin` | Administracion | Core | `/admin` |
| `crm` | CRM | Core | `/crm` |
| `agenda` | Agenda | Core | `/agenda` |
| `quotes` | Cotizaciones | Core | `/cotizaciones` |
| `catalog` | Catalogo | Core | `/catalogo` |
| `sales` | Ventas | Core | `/ventas` |
| `inventory` | Inventario | Core | `/inventario` |
| `dispatch` | Despacho | Core | `/despacho` |
| `hr` | RRHH | Core | `/rrhh` |
| `billing` | Facturacion | Opcional | `/facturacion` |
| `whapp` | Whapp / Inbox | Opcional | `/whapp`, `/inbox` |
| `reports` | Reportes | Opcional | `/dashboard` |
| `autoblog` | Autoblog | Opcional | `/autoblog` |
| `ai` | IA de configuracion | Opcional | `/admin/ia` |
| `purchases` | Compras | Opcional | `/compras` |
| `payments` | Pagos | Opcional | `/pagos` |
| `mobile` | App movil / API movil | Opcional | `/api/mobile` |
| `brain` | Business Brain | Opcional | `/brain` |

Nota: el repositorio contiene muchos mas modulos tecnicos (`permissions`, `notifications`, `tenant`, `sales-inventory`, `driver-tracking`, `inbox-widget`, `business-context`, etc.), pero esos no deben contarse como modulos de negocio independientes frente al usuario.

## Metodo De Revision

- Revisión manual en navegador sobre `https://innovabizos-wq-bizos.vercel.app`.
- Barrido de rutas principales con el usuario `USERPRUEBA2`.
- Verificacion adicional de permisos reales con `USERPRUEBA1`.
- Contraste con codigo fuente y documentacion existente.

## Hallazgos Globales Iniciales

### 1. El conteo correcto no es "30 modulos"

El sistema tiene 18 modulos de plataforma visibles y varios submodulos tecnicos auxiliares. Mezclar ambos niveles distorsiona la revision y hace imposible priorizar.

### 2. La experiencia real depende fuerte de permisos y modulos activos

Con `USERPRUEBA1` solo aparecian `Inicio` y `Despacho` en el sidebar. Con `USERPRUEBA2` aparecen los 18 puntos principales esperados. Esto confirma que la revision debe registrar siempre:

- usuario probado
- permisos visibles
- modulo activo o no

### 3. La plataforma carga amplia superficie, pero no toda esa superficie esta lista para operacion completa

Hay modulos que:

- cargan bien y muestran datos reales
- cargan pero siguen en estado de configuracion incompleta
- cargan y exhiben texto honesto de pendiente
- directamente rompen

## Estado Inicial Por Modulo

| Modulo | Estado inicial | Evidencia |
| --- | --- | --- |
| Administracion | Carga | `/admin`, `/admin/modulos`, `/admin/contexto`, `/admin/ia` cargan |
| CRM | Carga | `/crm/clientes` con dashboard y base de datos |
| Agenda | Carga | `/agenda` muestra planificador |
| Cotizaciones | Carga | `/cotizaciones` carga indicadores y tabla |
| Catalogo | Carga | `/catalogo` abre catalogo comercial |
| Ventas | Carga | `/ventas` abre analitica y tabla |
| Inventario | Carga | `/inventario` abre stock y salud de stock |
| Compras | Carga con pendiente visible | `/compras` muestra "Pendiente recepcion" |
| Pagos | Carga | `/pagos` abre movimientos recientes |
| Despacho | Carga | `/despacho` abre resumen y pendientes |
| Inbox | Carga | `/inbox` abre bandeja unificada |
| Whapp | Carga | `/whapp/conversaciones` abre conversaciones |
| Autoblog | Carga | `/autoblog` abre modulo |
| Business Brain | Carga | `/brain` abre snapshot, AI core y recomendaciones |
| RRHH personal | Carga | `/rrhh/personal` abre personal |
| RRHH planillas | Carga | `/rrhh/planillas/dashboard` abre control en tiempo real |
| Facturacion | Carga con configuracion pendiente | `/facturacion` muestra documentos vacios y configuracion incompleta |
| Nueva consulta | Rota | `/consultas/nueva` devuelve error de servidor |

## Hallazgos Confirmados

### Nueva consulta esta rota en produccion

Ruta: `/consultas/nueva`

Resultado manual:

- La pagina no carga.
- Muestra `This page couldn’t load`.
- Devuelve `ERROR 1621801304`.

Consola del navegador:

- `Error: An error occurred in the Server Components render`
- `Minified React error #418`

Impacto:

- Se rompe un flujo comercial que debia servir como entrada rapida desde dashboard.
- La funcionalidad existe en codigo y documentacion, pero hoy no es usable en Vercel.

### Modulos activos no significa modulos listos

En `/admin/modulos` se observaron estados mixtos:

- `billing`: activo pero mal configurado
- `ai`: activo pero mal configurado
- `purchases`: activo pero mal configurado
- `payments`: activo pero mal configurado
- `mobile`: activo pero mal configurado
- `whapp`: activo y con salud marcada como ok
- `brain`: activo y con salud marcada como ok

Implicacion:

La empresa puede ver un modulo como activo aunque operacionalmente siga incompleto. Eso introduce falsa sensacion de cobertura.

### Whapp / Inbox si tiene base real, pero su modelo operativo no es autoservicio

Revision manual:

- `/whapp/canales` carga y expone gestion de canales.
- `/whapp/canales/[canalId]` muestra salud del canal, eventos webhook asociados y no asociados.
- `/inbox/canales` carga y permite crear canal manual o Meta.

Revision por codigo y docs:

- Whapp reutiliza Inbox.
- Soporta `whatsapp`, `facebook`, `instagram`, `email` y `manual`.
- La operacion real Meta depende de provision tecnica, webhook y secretos.

Conclusión:

Whapp no esta “falso” ni vacio. Sí existe base tecnica real. El problema es otro: todavia no se presenta como una experiencia cerrada y autoservicio para un tenant normal, sino como un sistema que requiere provision y operacion de plataforma.

### Facturacion sigue siendo estructural, no operacion lista

La pantalla principal muestra:

- configuracion fiscal pendiente
- no hay documentos fiscales
- flujo dependiente de CABYS y configuracion

Esto coincide con el codigo y con la documentacion existente: hay base, pero no cierre operativo real de facturacion electronica.

### Autoblog funciona como workflow interno, no como publicacion externa conectada

Revision manual:

- `/autoblog` carga articulos y estados como `Aprobado` y `Listo para publicar`.
- `/autoblog/nuevo` expone creacion manual y herramientas de IA.

Revision por codigo y docs:

- Guarda copys para Facebook, Instagram, LinkedIn y WhatsApp.
- El estado `ready_to_publish` significa listo dentro de Biz.OS, no publicado afuera.
- No existe todavia publicacion automatica a WordPress, redes ni cron real de contenido.

Conclusión:

Autoblog hoy es un backoffice editorial interno. Sirve para redactar, revisar y dejar piezas preparadas. No sirve todavia como motor real de distribucion multicanal.

### Catalogo y stock siguen separados en la experiencia manual

Revision manual:

- `/catalogo/productos/nuevo` permite crear producto/servicio comercial.
- El formulario muestra tipo, codigo, categoria, nombre, unidad, descripcion, precio, impuesto y moneda.
- No muestra bodega ni cantidad inicial.

Revision por docs:

- `catalogo` declara explicitamente que no administra inventario ni stock.
- La conexion real con stock vive en inventario y en la salida manual desde ventas.

Conclusión:

Esto no es solo un bug visual. Es una decision de producto actual. El problema es que la experiencia resultante se siente incompleta para una empresa que espera “crear producto operativo” en un solo paso.

### Brain existe como superficie, pero depende de configuracion y de coberturas funcionales externas

`/brain` y `/admin/ia` cargan, pero el valor real del modulo sigue limitado por:

- estado incompleto de capacidades empresariales
- cobertura parcial de skills
- dependencias con pagos, ventas, despacho, agenda e inbox

## Relacion Con Revisiones Anteriores

Estos puntos siguen siendo validos y deben conservarse en la revision consolidada:

- alta administrativa de usuarios sin validacion de correo ya implementada
- correccion de permiso vendedor para confirmar ventas ya aplicada
- correccion de enlace catalogo -> cotizacion -> venta -> inventario ya validada
- flujo de despacho creado y asignado, pero no auditado todavia hasta entrega final por chofer

## Integraciones Y Canales Externos

### Meta / WhatsApp / Facebook / Instagram

Estado:

- Hay soporte de codigo para Meta.
- Existen formularios, checklist y salud de canal.
- Existen webhooks y normalizacion para `whatsapp`, `facebook` e `instagram`.

Limite actual:

- La configuracion esta pensada para provision tecnica por plataforma.
- No esta resuelto todavia como onboarding simple y comercial para cualquier empresa.

### Redes sociales desde Autoblog

Estado:

- Existen campos de copys por red.
- No existe publicacion externa automatica.

Limite actual:

- No hay integracion cerrada con Facebook, Instagram, LinkedIn ni WordPress.

### Facturacion / Hacienda

Estado:

- Existe configuracion fiscal, CABYS, recepcion, consecutivos y artefactos.
- La UI declara explicitamente varios pasos pendientes.

Limite actual:

- No hay cierre operativo real de firma XAdES-EPES ni ciclo completo Hacienda productivo.

## Cobertura Automatizada Disponible

La suite automatica actual pasa completa:

- `npm test`: 104/104
- `npm run test:e2e`: 12/12

Lectura correcta de ese resultado:

- La base contractual y arquitectonica del repo esta bastante cubierta.
- La cobertura no sustituye prueba real en navegador sobre Vercel.
- Hoy ya existe un ejemplo concreto donde ambas cosas divergen: `consultas/nueva` pasa la cobertura contractual y aun asi esta rota en produccion.

## Riesgos Reales Detectados

1. Se estaba mezclando arquitectura, cobertura funcional y salud visual en una sola conversacion.
2. Hay modulos activos con salud funcional incompleta.
3. Existen rutas productivas rotas aunque el modulo exista en codigo y en documentacion.
4. La percepcion de "todo esta ahi" no coincide con el nivel de operacion real extremo a extremo.
5. Integraciones visibles en UI todavia mezclan “base tecnica lista” con “producto comercial listo”.

## Siguiente Barrido

La siguiente pasada de esta revision debe profundizar en:

1. Integraciones: Whapp/Meta, facturacion/Hacienda, email y canales externos.
2. Modulos secundarios: consultas, autoblog, inbox, compras, pagos.
3. Flujos extremos a extremo por rol: admin, vendedor y chofer.
4. Mapeo funcional fino para convertir operaciones reales en futuras capabilities/skills de Brain.
