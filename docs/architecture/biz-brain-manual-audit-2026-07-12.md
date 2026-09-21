# Auditoria manual Biz.OS para Biz.Brain

Fecha: 2026-07-12
Ambiente probado: `https://innovabizos-wq-bizos.vercel.app`
Usuario observado: Antonio / empresa AINOVA

## Objetivo

Recorrer el sistema manualmente, usar modulos reales con datos de prueba,
entender que hace cada modulo y levantar el mapa de Business Capabilities que
deben convertirse en Skills consumibles por la barra y por el Brain Runtime.

La prueba no busca solo confirmar si una pantalla carga. Busca detectar si los
flujos empresariales cierran de punta a punta y si el resultado puede ser
ejecutado luego por Biz.Brain sin inventar datos.

## Datos de prueba creados

- Producto: `QA Producto Browser 202607121128`
  - Codigo: `QA-202607121128`
  - Precio: CRC 1500
  - Resultado: creado correctamente en Catalogo.
- Cliente: `QA Cliente Browser 202607121128`
  - Identificacion: `990011223`
  - Telefono/WhatsApp: `88881234`
  - Correo: `qa.browser.202607121128@test.com`
  - Resultado: creado correctamente en CRM.
- Cotizacion: `COT-2026-000035`
  - Cliente: `QA Cliente Browser 202607121128`
  - Item: `Alicate universal aislado 8 pulgadas`
  - Total: CRC 5650
  - Resultado: creada correctamente.
- Venta: `VEN-2026-000019`
  - Generada desde la cotizacion anterior.
  - Resultado: aparece en Ventas como confirmada.
- Cuenta por cobrar: `CXC-VEN-2026-000019`
  - Resultado: no aparecio automaticamente; aparecio despues de `Sincronizar CxC`.
  - Cobro parcial registrado: CRC 1000, referencia `QA-PAGO-202607121128`.
  - Saldo despues del cobro: CRC 4650, estado `Parcial`.
- Nota interna Inbox:
  - Conversacion WhatsApp `bryan Jz`.
  - Texto: `Nota QA Browser 202607121128: auditoria manual, no enviar al cliente.`
  - Resultado: nota visible y auditada.
- Articulo Autoblog:
  - Titulo: `QA Blog Browser 202607121128`
  - Resultado: borrador manual creado correctamente.

## Resultado por modulo

### Dashboard y barra IA

La barra global esta presente en todos los modulos y ejecuta acciones del Brain.
En pruebas previas sobre Vercel, varias consultas de lenguaje natural si
resolvieron datos reales: clientes, productos, stock, ventas, pagos, compras,
despachos y analisis del negocio.

Problema observado: el contexto de la pagina puede influir en el enrutamiento.
Comandos ambiguos ejecutados desde una pagina de modulo pueden caer en una
intencion local incorrecta. Desde Dashboard algunos de esos comandos si
resolvieron bien. Esto confirma la necesidad de Intent Resolver + Context
Builder + Capability, no parser superficial por pantalla.

Capabilities candidatas:

- `dashboard.kpi.summary`
- `dashboard.activity.list`
- `brain.command.route`
- `brain.intent.resolve`
- `brain.answer.explain`
- `brain.context.build`

### CRM

Flujos validados:

- Buscar cliente existente: `Alondra Perez` fue encontrado.
- Buscar cliente inexistente: devuelve que no encontro clientes.
- Crear cliente manualmente desde CRM: funciona.
- Ver ficha de cliente: muestra datos, cotizaciones, ventas, interacciones y
  seguimientos.

Problema observado:

- Crear cliente desde la barra en Vercel fallo con `Faltan datos o hay datos
  invalidos` aunque el comando tenia nombre, telefono y correo. La causa local
  encontrada fue que `optionalPhone` en el Action Registry realmente no era
  opcional para `telefono`/`whatsapp`. Ya quedo corregido localmente, pero
  Vercel requiere despliegue para reflejarlo.

Capabilities candidatas:

- `crm.customer.search`
- `crm.customer.create`
- `crm.customer.update`
- `crm.customer.detail`
- `crm.customer.list`
- `crm.customer.segment`
- `crm.customer.assign`
- `crm.customer.interaction.create`
- `crm.customer.followup.create`
- `crm.customer.timeline.query`
- `crm.customer.next_best`

### Catalogo

Flujos validados:

- Buscar producto existente desde barra: `Lentes seguridad transparentes`.
- Buscar producto inexistente: devuelve que no encontro productos.
- Crear producto manualmente desde Catalogo: funciona.
- Crear producto desde barra: pide confirmacion antes de ejecutar.

Problemas observados:

- Crear producto manualmente no inicializa stock en bodegas. En cambio, la
  creacion desde Brain/barra si reporto producto agregado a inventario en 2
  bodegas con stock 0. Hay inconsistencia entre flujos.
- Existen productos con nombres/codigos contaminados por texto de comandos:
  ejemplos visibles: `llamado Producto Prueba Brain con`, `codigo: 33442
  nombre: Masaje Categoria: otros`, `, cod:talat nombre:Taladro t`.
- Los selects de productos en Cotizaciones y Compras muestran datos sucios y
  listas largas, lo que dificulta uso real.

Capabilities candidatas:

- `catalog.product.search`
- `catalog.product.create`
- `catalog.product.update`
- `catalog.product.deactivate`
- `catalog.product.validate`
- `catalog.product.clean_names`
- `catalog.category.list`
- `catalog.category.create`
- `catalog.price.update`
- `catalog.product.stock.initialize`

### Inventario

Flujos validados:

- Consultar stock desde barra: `Lentes seguridad transparentes` devolvio stock
  real.
- Consultar productos con stock bajo: devolvio registros reales.
- El producto QA creado manualmente aparece en Catalogo pero no queda con stock
  registrado.

Problemas observados:

- Falta consistencia Catalogo -> Inventario al crear productos manualmente.
- La barra responde cantidades, pero todavia necesita evidencia mas rica por
  bodega, minimo, estado y ultimo movimiento para respuestas empresariales.

Capabilities candidatas:

- `inventory.stock.query`
- `inventory.low_stock.query`
- `inventory.reorder.suggest`
- `inventory.warehouse.list`
- `inventory.stock.adjust`
- `inventory.stock.transfer`
- `inventory.stock.movement.list`
- `inventory.minmax.update`
- `inventory.product.initialize`

### Cotizaciones

Flujos validados:

- Crear cotizacion manual desde ficha de cliente: funciona.
- Agregar item de catalogo: funciona.
- Confirmar venta desde cotizacion: funciona y cambia a `Venta generada`.

Problemas observados:

- El feedback al agregar item es poco visible; el usuario puede pensar que no
  paso nada.
- El selector de productos es largo y contiene datos sucios.
- Comandos naturales como `Crear una cotizacion para Prueba Brain` o `Preparar
  una proforma con dos productos` terminan en `Faltan datos o hay datos
  invalidos` en lugar de pedir aclaracion concreta.

Capabilities candidatas:

- `quotes.draft.create`
- `quotes.item.add`
- `quotes.customer.select`
- `quotes.product.search`
- `quotes.discount.suggest`
- `quotes.total.calculate`
- `quotes.status.update`
- `quotes.confirm_sale`
- `quotes.list`
- `quotes.expired.query`
- `quotes.reactivate`

### Ventas

Flujos validados:

- Venta generada desde cotizacion: `VEN-2026-000019`.
- Consultar ventas desde barra: devuelve ventas recientes reales.

Problemas observados:

- Confirmar venta no creo o no mostro automaticamente la cuenta por cobrar en
  Pagos hasta ejecutar `Sincronizar CxC`.
- No se observo creacion automatica de despacho para la venta QA.

Capabilities candidatas:

- `sales.list`
- `sales.detail`
- `sales.recent.query`
- `sales.summary.query`
- `sales.create_from_quote`
- `sales.receivable.sync`
- `sales.dispatch.prepare`
- `sales.customer.history`

### Pagos

Flujos validados:

- `Sincronizar CxC` creo la cuenta por cobrar de la venta QA.
- Registrar cobro parcial funciono.
- El saldo bajo de CRC 5650 a CRC 4650.
- El estado cambio a `Parcial`.
- El movimiento reciente quedo registrado.

Problemas observados:

- La sincronizacion CxC no ocurre automaticamente despues de venta confirmada.
- La pantalla depende de inputs inline por fila; para Brain esto requiere
  resolver la cuenta exacta antes de ejecutar.

Capabilities candidatas:

- `payments.receivable.sync`
- `payments.receivable.list`
- `payments.receivable.overdue.query`
- `payments.receivable.pending.query`
- `payments.collection.record`
- `payments.collection.reminder.create`
- `payments.account.cancel`
- `payments.movement.list`
- `payments.cashflow.summary`

### Compras

Flujos validados:

- Pantalla carga proveedores, ordenes, bodega, estado y hasta 5 items.
- Proveedor existente visible: `Pequeno mundo`.

Bloqueo detectado:

- Crear una orden de compra emitida fallo con:
  `No se pudo crear la orden: column reference "estado" is ambiguous`.

Esto bloquea el flujo principal proveedor -> orden -> recepcion -> inventario.
Es un error backend/SQL que debe corregirse antes de crear Skills de ejecucion
para compras.

Capabilities candidatas:

- `purchases.supplier.list`
- `purchases.supplier.create`
- `purchases.order.create`
- `purchases.order.query`
- `purchases.order.receive`
- `purchases.order.cancel`
- `purchases.reorder.suggest`
- `purchases.pending.query`
- `purchases.inventory.receive`

### Despacho

Flujos validados:

- Lista despachos reales.
- Muestra estados, responsable, venta origen, cliente y contacto.
- Detalle permite actualizar estado, resultado, fecha, responsable, direccion,
  contacto, telefono y notas.

Limitacion:

- No se modifico un despacho real existente para evitar afectar operacion.
- La venta QA no genero despacho visible automaticamente.

Capabilities candidatas:

- `dispatch.pending.query`
- `dispatch.detail`
- `dispatch.status.update`
- `dispatch.result.save`
- `dispatch.responsible.assign`
- `dispatch.schedule.update`
- `dispatch.from_sale.create`
- `dispatch.route.suggest`

### Inbox / WhatsApp

Flujos validados:

- Lista conversaciones por canal, estado, agente, no leidos y SLA.
- Detalle muestra historial, cliente vinculado, acciones rapidas, SLA,
  recomendaciones locales y auditoria.
- Nota interna agregada correctamente y auditada.

Problemas observados:

- La IA contextual declara que todavia no llama a modelo externo; hoy opera como
  contrato de datos/recomendaciones locales.
- Comandos de barra como `Preparar respuesta para WhatsApp` y `Responder el
  ultimo mensaje del cliente` no clasificaron correctamente en pruebas previas.
- Envio WhatsApp debe quedar separado de borrador y siempre pasar por politica
  de confirmacion/canal.

Capabilities candidatas:

- `inbox.conversation.list`
- `inbox.conversation.detail`
- `inbox.message.note.create`
- `inbox.reply.draft`
- `inbox.reply.send`
- `inbox.customer.link`
- `inbox.conversation.assign`
- `inbox.conversation.close`
- `inbox.sla.query`
- `inbox.conversation.summarize`
- `inbox.next_response.recommend`

### Agenda

Flujos observados:

- Vista calendario semanal.
- Proximos seguimientos.
- Acciones rapidas con muchos simbolos `+`.

Problemas observados:

- Los `+` del calendario aparecen en el texto, pero no se detectan como botones
  accesibles. Esto dificulta automatizacion, accesibilidad y pruebas.
- La barra si creo tareas en pruebas previas: `llamar a Prueba Brain` y
  `seguimiento con Prueba Brain`.

Capabilities candidatas:

- `agenda.task.create`
- `agenda.followup.create`
- `agenda.task.list`
- `agenda.task.complete`
- `agenda.task.reschedule`
- `agenda.overdue.query`
- `agenda.calendar.slot.create`
- `agenda.customer.followup.schedule`

### Autoblog

Flujos validados:

- Crear borrador manual: funciona.
- Editar articulo: funciona.
- Estados disponibles: borrador, revision, aprobado, listo para publicar,
  archivar.

Problemas observados:

- La pantalla indica `IA sin probar` y conexion pendiente en Administracion / IA.
- Pruebas previas de generacion IA fallaron por proveedor/modelo.
- Existen articulos guardados con JSON/Markdown crudo en el resumen/contenido.
- Hay duplicados de temas generados.
- Publicacion web/redes esta visible como flujo futuro, no operativa real.

Capabilities candidatas:

- `autoblog.article.generate`
- `autoblog.article.create_manual`
- `autoblog.article.edit`
- `autoblog.article.review`
- `autoblog.article.approve`
- `autoblog.article.ready_to_publish`
- `autoblog.article.archive`
- `autoblog.content.validate`
- `autoblog.output.normalize`
- `autoblog.social.copy.generate`
- `autoblog.provider.health`

### Brain

Flujos validados:

- Brain muestra snapshot con datos reales: CRM, prospectos, seguimientos,
  cotizaciones, ventas 30 dias, productos bajo minimo, CxC y Whapp.
- Muestra senales, insights, recomendaciones y planes.
- `Analizar negocio` ejecuta y vuelve a estado normal.

Problemas observados:

- El timestamp del snapshot no cambio despues de analizar; puede ser cache,
  revalidacion o falta de feedback.
- Hay recomendaciones con `SIN ACCION`, lo cual rompe la promesa de plan
  accionable.
- Existe al menos un plan en estado `failed`.
- Brain reporta 20 capacidades registradas, muy por debajo del catalogo
  empresarial necesario.

Capabilities candidatas:

- `brain.analysis.run`
- `brain.snapshot.build`
- `brain.signal.detect`
- `brain.insight.list`
- `brain.recommendation.create`
- `brain.plan.create`
- `brain.plan.approve`
- `brain.plan.execute`
- `brain.plan.status.query`
- `brain.question.answer`
- `brain.context.update`
- `brain.capability.status.explain`

### Facturacion

Flujos observados:

- Pantalla principal carga resumen fiscal.
- Estado de configuracion: `missing`.
- No hay documentos fiscales.
- CABYS carga y muestra 58 productos activos, todos sin CABYS.

Problemas observados:

- `/facturacion/configuracion` queda practicamente en blanco salvo layout.
- Sin configuracion fiscal y CABYS, la emision real no puede funcionar.
- La pantalla CABYS muestra datos sucios de Catalogo, lo que afecta preparacion
  fiscal.

Capabilities candidatas:

- `billing.config.status`
- `billing.fiscal_config.update`
- `billing.cabys.import`
- `billing.cabys.search`
- `billing.product_cabys.assign`
- `billing.invoice.draft.prepare`
- `billing.invoice.issue`
- `billing.document.list`
- `billing.document.status.query`
- `billing.received_document.list`

### RRHH y Planillas

Flujos observados:

- RRHH lista personal activo e invitaciones.
- Planillas muestra estado en vivo por colaborador.
- Estados permite inicializar, crear, activar/desactivar y editar estados
  laborales.

Problemas observados:

- El colaborador aparece sin estado/sin login en dashboard de planillas.
- La pantalla de Estados repite muchos formularios y es dificil de leer.
- Crear invitaciones o personal debe requerir confirmacion alta porque afecta
  acceso de usuarios.

Capabilities candidatas:

- `hr.employee.list`
- `hr.employee.invite`
- `hr.employee.update`
- `hr.timesheet.dashboard`
- `hr.timesheet.status.set`
- `hr.timesheet.alerts.query`
- `hr.work_state.initialize`
- `hr.work_state.create`
- `hr.work_state.update`
- `hr.work_state.activate`
- `hr.work_state.deactivate`

### Administracion / IA / Contexto

Flujos observados:

- Admin muestra empresa, usuario, plan, permisos y modulos activos.
- IA central muestra proveedor activo `gemini`, modelo
  `gemini-2.5-flash-lite`, credencial presente y estado `Error de conexion`.
- La consola de prueba del Brain lista 20 acciones actuales.
- Contexto del negocio esta estructurado por identidad, mercado, oferta,
  operacion e instrucciones de IA.

Problemas observados:

- El proveedor IA esta activo pero en error; esto explica fallos de Autoblog y
  respuestas generativas.
- La consola de prueba de acciones es util, pero no reemplaza lenguaje natural.
- El contexto del negocio debe alimentar oficialmente al Context Builder.

Capabilities candidatas:

- `admin.ai.config.read`
- `admin.ai.config.update`
- `admin.ai.connection.test`
- `admin.brain.skill.dry_run`
- `admin.brain.skill.execute`
- `admin.audit.list`
- `admin.business_context.read`
- `admin.business_context.update`
- `admin.module.list`
- `admin.permission.query`

## Errores y fricciones priorizadas

1. Compras esta bloqueado por SQL: `column reference "estado" is ambiguous`.
2. Vercel aun falla al crear cliente desde barra con telefono/correo completos;
   la correccion local de `optionalPhone` debe desplegarse.
3. Proveedor IA en Admin esta en error; Autoblog/Brain generativo quedan
   parcialmente inutiles hasta corregir modelo/API key/base URL.
4. Facturacion fiscal esta incompleta: configuracion `missing` y pantalla
   `/facturacion/configuracion` en blanco.
5. Catalogo tiene datos contaminados por comandos naturales mal parseados.
6. Crear producto manual no inicializa stock, pero crear producto por Brain si.
7. Venta confirmada no sincroniza CxC automaticamente; requiere accion manual.
8. Venta QA no genero despacho visible automaticamente.
9. Cotizaciones y Compras usan selects largos con productos sucios y sin buena
   busqueda contextual.
10. Comandos de cotizacion/proforma no piden aclaraciones utiles; devuelven
    `Faltan datos o hay datos invalidos`.
11. Comandos de WhatsApp/Inbox no clasifican bien intenciones basicas.
12. Agenda tiene acciones `+` no accesibles como botones.
13. Brain tiene recomendaciones con `SIN ACCION` y planes fallidos.
14. `Analizar negocio` no actualiza claramente el timestamp visible.
15. Autoblog tiene articulos con JSON/Markdown crudo guardado como contenido.

## Implicacion para Biz.Brain

La conclusion principal es que Biz.Brain no debe intentar "entender todo" solo
con mas frases en un parser. El sistema ya tiene flujos empresariales reales,
pero muchos estan incompletos, desincronizados o no tienen contrato estable.

El Brain Runtime debe ejecutar capacidades, no pantallas:

```text
Intent -> Capability -> Slots -> Policy -> Skill -> Datos reales -> Respuesta
```

Cada modulo necesita primero exponer sus operaciones como capacidades atomicas.
Despues la barra, los modulos, jobs, webhooks y futuros agentes consumen esas
capacidades. Si una capability no puede cerrar manualmente en UI, no debe
prometerse como Skill automatizada.

## Siguiente ruta recomendada

1. Corregir bloqueadores operativos antes de ampliar catalogo:
   - compras `estado` ambiguo
   - despliegue de `optionalPhone`
   - proveedor IA en Admin
   - facturacion/configuracion en blanco
2. Normalizar datos contaminados de Catalogo y prevenir que el parser cree
   nombres sucios.
3. Convertir los flujos que ya cerraron manualmente en Skills confiables:
   - cliente crear/buscar
   - producto crear/buscar/inicializar inventario
   - cotizacion crear/agregar item/confirmar venta
   - ventas listar/sincronizar CxC
   - pagos registrar cobro
   - inbox nota interna/borrador respuesta
   - autoblog borrador manual/validacion
4. Hacer que Brain responda con aclaraciones especificas cuando falten slots.
5. Crear pruebas E2E de lenguaje natural por modulo con caso positivo y
   negativo, y pruebas manuales de flujo completo antes de declarar una Skill
   productiva.
