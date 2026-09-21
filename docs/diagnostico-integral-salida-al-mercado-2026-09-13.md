# Biz.OS: diagnóstico integral y ruta de salida al mercado

Fecha de revisión: **13 de septiembre de 2026**. Alcance: los **18 módulos del catálogo de plataforma**, sus componentes transversales, base de datos conectada, integraciones, operación SaaS y preparación comercial.

## 1. Dictamen

**Biz.OS tiene una base aprovechable y una amplitud considerable de funcionalidades. Todavía no está listo para venderse como una suite empresarial completa, autónoma y confiable. La vía eficiente es consolidar el sistema existente, lanzar un paquete comercial acotado y ampliar sus capacidades con evidencia de uso.**

El principal problema es la distancia entre cuatro cosas: lo que describe la documentación, lo que muestra la interfaz, lo que implementa el código y lo que ha sido comprobado de extremo a extremo. Agregar más pantallas o más agentes antes de resolver esa distancia aumentaría el costo de soporte y retrasaría ingresos.

Recomendación de producto: **un centro de operación para pymes costarricenses que conecta clientes, cotizaciones, ventas, inventario, cobros y entregas, con atención por mensajería e IA asistida**. La facturación electrónica debe integrarse a ese circuito; no debe convertirse en todo el producto ni obligar a reconstruir primero un proveedor fiscal.

Como segmento inicial, propongo negocios de servicios con productos y distribución ligera: es una hipótesis basada en las capacidades existentes, que se debe validar con tres empresas piloto. Evitar al inicio sectores que exijan lotes, vencimientos, producción, nómina especializada o puntos de venta sin conexión.

## 2. Qué se comprobó y qué no

Se revisaron el historial de Git y cambios locales; documentación de arquitectura y módulos; rutas, acciones, consultas, permisos, cálculos e integraciones; migraciones; scripts de pruebas; configuración de despliegue y tareas programadas. Se ejecutaron pruebas, revisión de tipos, lint y compilación. También se consultaron, en modo lectura, metadatos, avisos de seguridad/rendimiento y algunos estados agregados de la base conectada `biz-os-dev`.

La comparación externa utiliza documentación de los propios fabricantes y de Hacienda consultada en esta fecha. No se contactó a proveedores, emitieron comprobantes, enviaron mensajes, ejecutaron migraciones ni alteraron datos empresariales.

Esta revisión **no sustituye una prueba de usuario de cada pantalla con cada rol ni un ensayo fiscal real**. Tampoco confirma que el código local coincida con el despliegue actual. La existencia de tablas o de estados “completed” no demuestra por sí sola que una operación externa haya terminado bien.

### Resultados reproducibles

| Verificación | Resultado | Interpretación |
| --- | --- | --- |
| `npm run typecheck` | Sin errores | El proyecto supera la comprobación de tipos local |
| `npm run build` | Compilación completa satisfactoria al repetir con permisos adecuados | El primer intento falló por acceso a directorios en el entorno restringido; no se considera defecto del código |
| `npm run test` | **182 pruebas: 179 pasan y 3 fallan** | No cumple todavía una puerta de publicación con pruebas en verde |
| `npm run lint` | **1 error y 2 advertencias** | Error de pureza por `Date.now()` en selección de cuenta Meta; advertencias en archivos generados de Workflow |
| Tablas de `public` en base conectada | **127 de 127 con RLS activado** | Buena base; hace falta comprobar las políticas y funciones, no solo el indicador |
| Historial de migraciones remoto | **49 entradas** | No coincide directamente con los 80 archivos de `database/migrations` y 25 de `supabase/migrations` |
| Documentos fiscales / artefactos fiscales | **0 / 0** en base inspeccionada | Sin evidencia de ciclo fiscal completado en esa base |
| Ejecuciones Brain | 111 `completed`, 2 `failed`, 7 `running`, 2 `waiting_approval` | Hay actividad real registrada; requiere revisión de resultados y cierres |
| Antigüedad de Brain pendiente | Los 7 `running` datan del 16–17 de agosto | Estados de casi cuatro semanas que necesitan recuperación o cierre explícito |
| Evaluaciones Brain persistidas | **0** | Existen pruebas locales, pero no hay historial de evaluaciones en `brain_eval_runs` |
| Canales Meta | 2 Facebook y 1 WhatsApp activos/configurados | Configuración registrada; no certificación de entrega actual |
| Salud modular registrada | 24 `healthy`, 10 `misconfigured`, 20 `inactive` | Son registros por empresa/configuración; no 54 módulos distintos |

Las pruebas fallidas son: lista permitida de consumidores de `service_role`, contrato de búsqueda/identificación CRM y contrato de acceso a Platform Console. La primera refleja nuevos consumidores privilegiados fuera de la lista de prueba; la segunda falla por un texto esperado; la tercera detecta uso de cliente privilegiado en una página de plataforma. **No son tres vulnerabilidades demostradas**, ni se deben “arreglar” aceptando cualquier comportamiento: revisar los accesos y después actualizar los contratos que estén obsoletos.

Evidencia local: `scripts/mvp-e2e-contract.test.mjs`, `scripts/platform-console-contract.test.mjs`, `src/app/(app)/inbox/conexiones/seleccionar-meta/page.tsx:20`. Registros de esta ejecución: `tmp-diagnostic-tests.log`, `tmp-diagnostic-types.log`, `tmp-diagnostic-lint.log`, `tmp-diagnostic-build-unrestricted.log`.

## 3. Qué se ha estado construyendo

El historial muestra una primera base modular en mayo; consolidación de permisos, compras, pagos y plataforma en junio; ampliación de Brain y flujos operativos en julio; y trabajo en mensajería, experiencia de usuario, IA y automatización durante agosto.

En el momento de la revisión hay **101 archivos versionados modificados**, con aproximadamente 20.840 líneas agregadas y 5.969 retiradas, además de numerosos archivos sin incorporar al control de versiones. El último commit visible es del 10 de agosto. Estos cambios locales contienen parte importante de las nuevas capacidades y deben conservarse y organizarse antes de publicar.

El trabajo tiene dirección técnica valiosa: módulos por dominio, permisos, RLS, operaciones mediante funciones de base de datos, contexto empresarial compartido, herramientas de IA con contratos, trazabilidad e idempotencia. La inversión es reutilizable.

La debilidad es el cierre y la trazabilidad de entregas. El README y documentos de junio aún describen Brain como conceptual y algunas capacidades como inexistentes, aunque ahora sí tienen código y tablas. Una revisión de julio describe defectos de interfaz que pudieron cambiar después. No conviene copiar esos diagnósticos como estado actual.

**Acción:** establecer una versión candidata identificable, un registro de capacidades verificadas y un historial único de cambios de esquema. Las tablas avanzadas de Brain y Meta existen remotamente aunque varias migraciones locales no aparecen con el mismo nombre/versión en el historial consultado. Eso apunta a diferencias de registro o aplicaciones manuales; no autoriza a reaplicar todas las migraciones.

## 4. Diagnóstico de todos los módulos

Los estados siguientes describen evidencia de implementación y el cierre pendiente; no son porcentajes inventados de madurez.

| Módulo | Qué existe actualmente | Qué falta para venderlo con confianza | Decisión de lanzamiento |
| --- | --- | --- | --- |
| **Administración** | Autenticación, onboarding, usuarios, invitaciones, roles, sucursales, módulos y consola de plataforma | Pruebas reales por rol y empresa, ciclo de baja/recuperación, permisos privilegiados auditados, onboarding con verificación de preparación | Imprescindible; estabilizar antes del piloto |
| **CRM y Nueva consulta** | Clientes, búsqueda, interacciones, responsables, seguimientos y creación desde Inbox | Resolver errores ocultos, paginar, evitar duplicados normalizados y comprobar el recorrido de captura a venta | Imprescindible; flujo rápido de alta/importación |
| **Agenda** | Seguimientos comerciales, filtros, estados y resumen; hay recordatorios internos | Recordatorios independientes de que el usuario tenga abierta la app; vencimiento y asignación probados | Incluir seguimiento simple; calendarios externos después |
| **Catálogo** | Productos, servicios, categorías, precios, impuestos y vínculo con cotizaciones; el alta reciente incorpora operación de inventario | Alta consistente producto–bodega–saldo, importación con prevalidación, CABYS y moneda coherentes, restricciones de duplicados | Incluir; listas de precio complejas después |
| **Cotizaciones** | Crear, editar, líneas ligadas a catálogo, estados y conversión a venta | Recuperación del flujo compuesto si falla a mitad, comprobación de totales y redondeos, salida comercial fácil de compartir | Incluir como entrada principal de ventas |
| **Ventas** | Órdenes desde cotizaciones, estados, notas, vínculo a inventario, pagos y despacho | Un recorrido guiado con estados separados de cobro, entrega y fiscalidad; cancelación/devolución consistente | Imprescindible; cerrar todo el circuito |
| **Inventario** | Bodegas, movimientos, mínimos, importación de materiales, salida por venta y traslados | Traslado atómico, concurrencia, reintentos sin duplicar, reversión y trazabilidad; separar stock disponible/reservado si el segmento lo necesita | Imprescindible en empresas con productos |
| **Despacho y logística** | Despachos desde ventas, responsables, estados, mapa y base de ubicación de choferes | Prueba desde teléfono real, permiso del chofer, evidencia de entrega y recuperación de conectividad; verificar sincronización con venta | Piloto con entrega simple; optimización de rutas después |
| **RRHH** | Personal reutiliza usuarios/invitaciones; planillas registra estados de asistencia y tiempos | Separar trabajador de usuario del SaaS cuando sea necesario, validar jornadas/correcciones; no hay evidencia de nómina salarial integral | Vender como personal/asistencia; integrar nómina más adelante |
| **Facturación** | Configuración fiscal, cifrado, CABYS, secuencias, documentos, cálculos, XML básico, recepción y representación HTML | Proveedor real, ciclo de aceptación, archivos, notas/recepción y recuperación; motor directo incompleto | Prioridad de integración; ver apartado 8 y anexo |
| **Whapp / Inbox** | WhatsApp y Facebook configurados; código de Instagram, conexión Meta, conversaciones, plantillas, campañas, clasificación, salud, costos y políticas | Onboarding comercial verificado, entrega real, permisos Meta, reintentos y cola suficientemente frecuente, pruebas de revocación y recuperación | Ofrecer canal validado por cliente; campañas tras corregir operación |
| **Reportes / Dashboard** | Indicadores por dominio, vista de dirección y reportes fiscales/Whapp | Definiciones únicas de ventas, cobros y margen; agregaciones completas, filtros y exportación; distinguir error de cero y actividad real de etiquetas visuales | Incluir pocos indicadores reconciliables |
| **Autoblog** | Edición, temas, generación IA, investigación, revisión/aprobación y copys | Publicación externa, devolución del ID/URL publicado y medición; actualmente los copys se publican manualmente | Complemento opcional; no bloquear salida por automatizar redes |
| **IA** | Proveedores reales, configuración por empresa, conversación, análisis y registro de uso | Control efectivo de costo acumulado, calidad medida, límites de llamadas, degradación y datos insuficientes | Asistente limitado a tareas validadas |
| **Compras** | Proveedores, órdenes, recepción parcial y relación con stock/cuentas por pagar | Probar recepción repetida/concurrente, devoluciones, costo y saldo correctos; hacer visible cualquier fallo parcial | Incluir en piloto de inventario; alcance simple |
| **Pagos** | Cuentas por cobrar/pagar, abonos, vencimientos y bloqueo de sobrepago | Conciliación verificable, idempotencia del cobro, reversión auditada, prueba de concurrencia y conexión con comprobantes | Incluir registro y saldo; banca automática después |
| **Móvil** | API de bootstrap y despacho; parte de la interfaz web utilizable en móvil | Experiencia completa por rol, captura de ubicación/evidencia, errores de red y sesiones; una API no equivale a una app | Web móvil enfocada primero; app nativa después |
| **Business Brain** | Runtime, herramientas, memoria, conocimiento vectorial, equipos, workflows durables, tareas humanas, políticas, autonomía y evaluaciones | Recuperación de ejecuciones, presupuesto real, autorización al reanudar, calidad medida, aprobaciones y resultados verificables | Lanzar copiloto útil; autonomía progresiva |

Componentes transversales: contexto del negocio, notificaciones, auditoría, planes y consola de operador deben formar parte del cierre. No son módulos extra para inflar el catálogo. El contexto debe tener fuente/fecha; las notificaciones deben llegar sin depender de navegación; el operador necesita diagnóstico por cliente y capacidad de pausar integraciones.

## 5. Hallazgos que afectan el funcionamiento completo

### P0: procesos económicos que pueden quedar incompletos

**Traslados de inventario.** `src/modules/inventory/actions.ts:1055` retira stock y después registra la entrada mediante dos llamadas separadas. Si falla la segunda intenta una tercera llamada compensatoria. Si el proceso se interrumpe después de la salida, o también falla la compensación, el traslado queda incompleto. Es un riesgo confirmado por estructura de código, no una pérdida observada en datos.

Solución: una función transaccional para todo el traslado, con bloqueo de las existencias involucradas, validación por empresa y clave idempotente. Criterio de aceptación: interrumpir o repetir la solicitud no cambia el total global de unidades ni crea dos traslados.

**Conversión comercial y cobros.** Hay buenas funciones transaccionales individuales, pero la confirmación rápida de cotización encadena cambios de estado, generación de venta, confirmación y sincronización de cuentas (`src/modules/quotes/actions.ts:581`). Una llamada fallida no deshace automáticamente las anteriores. Probar y cerrar ese recorrido como una operación recuperable. El correo, WhatsApp y proveedor fiscal deben salir de una cola persistente posterior a la transacción de negocio.

### P0: seguridad y operación de la plataforma

Supabase reportó:

- Protección contra contraseñas filtradas deshabilitada: habilitar y comprobar. [Guía oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Cuatro funciones con `search_path` mutable: tres de Autoblog y `generate_fiscal_consecutivo`. Las definiciones inspeccionadas no son `SECURITY DEFINER`; corregir el endurecimiento sin describirlas como fuga demostrada. [Remediación](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- 128 funciones privilegiadas ejecutables por usuarios autenticados. Varias forman parte del diseño; verificar para cada una sesión, empresa, permiso, módulo, argumentos e integridad. No revocar todas indiscriminadamente. [Remediación](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Dos avisos de ejecución anónima sobre `asignar_crm_cliente_numero` y `notify_brain_work_item_assignment`. Se comprobó que ambas devuelven `trigger`: el aviso no prueba que sean RPC explotables. Revisar privilegios y retirar exposición innecesaria. [Remediación](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Dos tablas con RLS y sin políticas, relacionadas con OAuth/eliminación Meta. Puede ser una decisión correcta para acceso exclusivo del backend; verificarla, sin abrir políticas generales para quitar el aviso. [Referencia](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

También existen archivos locales de token/pruebas y archivos comprimidos que aparecen sin seguimiento. No se inspeccionó ni divulgó su contenido. `.vercelignore` ya excluye varios, pero `.gitignore` no cubre todos. Antes de consolidar la versión, clasificar esos archivos y excluir secretos/respaldos. Rotar únicamente las credenciales cuya exposición se confirme.

### P1: errores que parecen ausencia de datos

En `src/modules/crm/queries.ts:258`, un error al cargar clientes termina en `ok([])`. Las consultas de métricas también usan arreglos vacíos al faltar resultados. El usuario puede interpretar “no tengo clientes/ventas” cuando falló una consulta. Revisar el mismo patrón en los otros dominios, diferenciando errores, permisos y resultados realmente vacíos.

Solución: estados explícitos de error y reintento, registro con identificador de incidente y métricas marcadas como incompletas. Un indicador de cero debe representar un cero real.

### P1: escala de consultas y paneles

La consulta CRM obtiene clientes y cuatro colecciones relacionadas sin paginación explícita ni agregación SQL. Esto aumenta transferencia y memoria y puede producir métricas parciales al alcanzar límites de respuesta de la API.

El asesor remoto reporta 148 claves foráneas sin índice de cobertura, 4 avisos de evaluación repetida en RLS y 33 de políticas permisivas múltiples. Son candidatos de optimización, **no prueba de lentitud observada**. Medir primero las consultas críticas y agregar índices acordes al filtro/orden real. Los 350 índices marcados como no usados no deben eliminarse automáticamente en una base con poco tráfico. [Índices](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [políticas](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

### P1: automatización que no llega a tiempo

`vercel.json` programa campañas una vez al día. La ruta usa un límite predeterminado de tres destinatarios y el despachador se detiene al completar ese lote. Hay otros caminos de invocación, por lo que esto no significa que el sistema entero solo pueda enviar tres mensajes diarios; **sí significa que el cron configurado no vacía una campaña comercial normal**.

Los recordatorios de agenda se generan desde `/api/notifications/poll`, ligado al uso de la aplicación. Las tareas de Brain también tienen un cron diario. Ajustar la frecuencia según cada compromiso, con una cola durable, reservas de trabajo, reintentos y límites por empresa. Evitar depender de que un empleado mantenga abierta una pestaña.

### P1: Brain necesita control operativo de verdad

Siete ejecuciones antiguas siguen en `running`; dos esperan aprobación desde agosto. Añadir vencimiento, pausa/cancelación, recuperación después de interrupción y explicación al operador. No cambiar sus estados automáticamente sin revisar si hubo efectos parciales.

Los equipos declaran presupuesto en dólares y tiempo, y lo persisten, pero en las rutas de ejecución inspeccionadas no se encontró un corte efectivo por costo acumulado o vencimiento. Sí hay límites de pasos y salida del modelo. Reservar presupuesto antes de llamar al proveedor, acumular costo de todas las iteraciones y detener al llegar al límite.

Los workflows reciben tokens de acceso de usuario y revalidan identidad. Eso es mejor que confiar en un `empresa_id` arbitrario, pero las ejecuciones largas necesitan resolver expiración de sesión, revocación, almacenamiento seguro del token y reautorización al reanudar. No sustituirlo por privilegios globales permanentes.

La idempotencia actual de herramientas evita algunas repeticiones; si la mutación termina y falla el registro final, la herramienta puede aparecer como fallida aun habiendo producido efectos. La garantía de no duplicar debe existir también en la operación de dominio.

### P1: experiencia comercial y promesas

El dashboard de dirección incluye nombres como “CEO AI” y roles predefinidos. Cada tarjeta debe mostrar si corresponde a una ejecución real, una capacidad disponible o una recomendación. “Optimizando entregas” no debe sugerir un optimizador de rutas si solo hay un enlace a despacho.

RRHH debe presentarse como asistencia/personal mientras no haya cálculo de salarios y ciclo de nómina. Autoblog distingue correctamente “listo para publicar” de publicación externa; conservar esa claridad.

### P1: pruebas, despliegue y mantenimiento

Muchas pruebas verifican texto/estructura mediante expresiones regulares; otras sí prueban lógica de Brain con sustitutos de dependencias. El comando `test:e2e` apunta a un archivo de contratos, no a un recorrido completo en navegador. Mantener esas pruebas y complementarlas con pruebas reales de negocio y RLS.

No se encontró un pipeline de CI versionado en `.github` ni instrumentación central de errores en las rutas revisadas. La infraestructura podría tener controles externos no visibles aquí. Dejar comprobados: entorno de ensayo, publicación automática con puertas de calidad, restauración de respaldo, monitoreo, alertas y procedimiento de soporte.

## 6. Comparación con sistemas actuales

| Referencia vigente | Capacidad documentada | Qué conviene adoptar en Biz.OS |
| --- | --- | --- |
| [Odoo 19: agentes](https://www.odoo.com/documentation/19.0/applications/productivity/ai/agents.html) | Asistencia en lenguaje natural que actúa mediante herramientas del sistema | Mantener contratos y permisos; medir tareas terminadas, no número de agentes |
| [Odoo: soporte con IA](https://www.odoo.com/documentation/19.0/applications/productivity/ai/support_operations.html) | IA integrada al trabajo de soporte y apoyada en documentación | Conocimiento aprobado, sugerencias contextuales y transferencia a personas |
| [HubSpot Customer Agent, actualizado en agosto de 2026](https://knowledge.hubspot.com/customer-agent/set-up-the-customer-agent) | Respuestas sustentadas, aclaraciones o derivación humana según confianza | Validar Brain + Whapp con fuentes, política de escalamiento y costo por resolución |
| [Shopify Flow](https://help.shopify.com/en/manual/shopify-flow/reference) | Automatizaciones por eventos, condiciones, acciones y conectores | Plantillas concretas: venta confirmada, pago vencido, stock bajo; no un constructor universal antes del piloto |
| [Alegra API](https://developer.alegra.com/) | Facturación, gastos, inventarios, bancos y sincronización con otros sistemas | Interoperabilidad con contratos estables; una integración debe devolver estado y evidencia |
| [Odoo EDI](https://www.odoo.com/documentation/19.0/applications/finance/accounting/customer_invoices/electronic_invoicing.html) | Intercambio de documentos estructurados y formatos según localización | Separar modelo comercial de adaptación fiscal por proveedor/país |

La conclusión de esta comparación es una inferencia de producto: **la ventaja comercial está en completar procesos conectados y confiables con menos trabajo humano**. Biz.OS ya incorpora varias ideas modernas —herramientas tipadas, búsqueda de conocimiento, workflows y aprobaciones—; su brecha principal es confiabilidad, integración y facilidad de puesta en marcha.

No propongo reemplazar Next.js/Supabase, dividir todo en microservicios ni migrar de modelos de IA como paso previo. Conservar una aplicación modular, una base transaccional y un mecanismo durable de trabajo reduce cambios y superficie de mantenimiento. Reutilizar Workflow donde ya funciona, comprobando su operación y costos; introducir otra infraestructura solo si existe una limitación medida.

## 7. Circuitos que definen un sistema funcional

1. **Cliente a cobro:** alta o consulta → cotización → venta confirmada → cuenta por cobrar → abono/pago → saldo conciliable. Repetir la confirmación no duplica venta ni deuda.
2. **Compra a existencia:** proveedor → orden → recepción parcial/completa → movimiento de inventario → cuenta por pagar. Repetir la recepción no duplica unidades.
3. **Venta a entrega:** decisión de reserva/salida → despacho → asignación → entrega/incidencia/devolución → venta actualizada. El stock y la evidencia de entrega se pueden reconstruir.
4. **Venta a comprobante:** datos fiscales → proveedor → estado oficial → XML/respuesta/PDF → entrega al cliente → corrección por nota cuando corresponde.
5. **Conversación a seguimiento:** mensaje → cliente → responsable → actividad/cotización → respuesta con política del canal → siguiente acción.
6. **Dato a decisión:** indicador verificable → recomendación Brain con evidencia → aprobación si procede → herramienta permitida → resultado persistido y medido.
7. **Alta de cliente SaaS:** cuenta → empresa → plantilla de módulos/roles → importación → conector → primera operación → soporte y plan.

Los estados comercial, financiero, logístico y fiscal deben permanecer separados pero relacionados: una venta puede estar entregada y pendiente de pago; un comprobante puede estar procesando; un pago registrado no prueba conciliación bancaria. Estos estados deben entenderse desde una misma ficha.

## 8. Facturación: prioridad de conectividad

### Qué falta realmente

No se encontró un adaptador para GTI, Alegra o FacturaProfesional en el código revisado. `getBillingXmlSigner()` siempre devuelve un firmador que lanza error. Lo mismo ocurre con el validador XSD y el cliente Hacienda, incluso al habilitar sus opciones.

El generador XML básico solo contempla 01/02/03/04, fija CRC y códigos de contado/medio de pago, y no produce un documento completo verificado contra el esquema oficial. La representación “PDF” es HTML imprimible de resumen. La recepción extrae campos mediante expresiones regulares; no valida autenticidad ni estructura completa. Tener tablas para otros tipos no implica soportarlos de extremo a extremo.

Evidencia: `src/modules/billing/signing/signer.ts`, `xml/validation.ts`, `hacienda/client.ts`, `xml/builders.ts`, `pdf/representation.ts`, `received/xml.ts`.

### Orden de conectores recomendado

| Opción | Evidencia y límites | Ruta recomendada |
| --- | --- | --- |
| **GTI** | Ofrece integración ERP y documenta una integración WooCommerce con cuenta/usuario/contraseña y pruebas solicitadas a GTI. Eso no certifica un OAuth público ni el contrato REST actual de emisión | Primer conector por prioridad del proyecto, condicionado a recibir contrato técnico vigente, acceso de pruebas y condiciones comerciales |
| **FacturaProfesional / ComprobantesElectronicosCR** | El fabricante dirige la integración ERP a su API y describe generación, firma, envío, XML y PDF | Alternativa de salida si habilita antes el entorno; segundo conector para validar que la arquitectura no depende de GTI |
| **Alegra** | API pública con creación/consulta de facturas y ejemplos de Costa Rica 4.4 | Priorizar cuando los pilotos ya lo utilicen; definir sincronización de clientes/productos y evitar duplicar inventario |
| **Tico Factura de Hacienda** | Facturador gratuito accesible mediante OVi; no se encontró documentación pública suficiente para conectar Biz.OS directamente a la aplicación con OAuth/API de emisión | Ofrecer coexistencia e importación de comprobantes emitidos afuera; no presentar un botón de emisión conectado como terminado |
| **API de recepción de Hacienda** | API oficial para enviar comprobantes preparados y consultar respuesta | Adaptador directo posterior: Biz.OS asumiría XML, firma, catálogos, autenticación, mantenimiento y recuperación |
| **Otros REST** | Cada proveedor tiene contrato, estados y credenciales propios | Perfil REST configurable con mapeo validado; no prometer compatibilidad automática con cualquier URL |

Fuentes: [GTI](https://www.facturaelectronica.cr/), [manual oficial de integración GTI](https://cdn.gticr.com/gticr/Documentos/Documentacion_Plugin.pdf), [FacturaProfesional](https://www.facturaprofesional.com/landings/version-4-4), [API ComprobantesElectronicosCR](https://www.comprobanteselectronicoscr.com/), [Alegra: crear factura](https://developer.alegra.com/reference/post_invoices), [Alegra: consultar factura](https://developer.alegra.com/reference/get_invoices-id), [aviso oficial Tico Factura](https://www.hacienda.go.cr/docs/FacturadorGratuitoTICOFACTURADisponibleAPartirdel06deoctubre.pdf), [API oficial de comprobantes](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html).

Estos son candidatos conocidos con evidencia de integración; **no se encontró una estadística independiente suficiente para ordenarlos por cuota de mercado en Costa Rica**. Tampoco se confirmaron precios de integración, acuerdos de reventa o permisos para operar múltiples clientes. No confundir `ticofactura.cr`, una web comercial, con el servicio gratuito de Hacienda.

“Un clic” debe significar que el usuario elige **Conectar GTI**, completa una autorización o configuración inicial breve y recibe “Conexión verificada”. Si el proveedor exige credenciales/cuenta fiscal, eso no desaparece. La compra del servicio, alta tributaria y configuración inicial pueden requerir asistencia. Después, la operación sí debe ser de un clic, sin copiar datos entre pantallas.

Para Tico Factura, abrir OVi no equivale a integrar. Mientras no haya una interfaz oficial confirmada, la opción honesta es emitir allí y adjuntar/importar XML y respuesta en Biz.OS para relacionarlos con la venta. La API de recepción fiscal y la API pública de consulta de contribuyentes/CABYS son servicios distintos; esta última no emite facturas. [API de consulta](https://api.hacienda.go.cr/docs).

### Cambio normativo que afecta el calendario

Hacienda publicó ajustes a los anexos 4.4 con nuevos códigos de referencia que deben implementarse desde el **1 de noviembre de 2026**, disponibles antes en pruebas/producción. El aviso también aclara identificaciones jurídicas alfanuméricas cuando lo comunique el Registro Nacional. Versionar catálogos y reglas, y exigir al proveedor cobertura del anexo actualizado. Revisar normalizaciones que eliminan letras; no cambiar a ciegas la composición legal de la clave numérica. [Comunicado oficial](https://www.hacienda.go.cr/docs/ActualizacionAnexosyEstructurasVersion4.4CEv2.pdf).

El [anexo de conectores](./arquitectura-conectores-facturacion-2026-09-13.md) define la experiencia, responsabilidades, datos, recuperación, API REST y pruebas necesarias.

## 9. Ruta eficiente de ejecución

Estimaciones orientativas, no compromiso: suponen una persona desarrolladora dedicada, apoyo de producto/QA y un contador para casos fiscales, acceso temprano al proveedor y ausencia de una reconstrucción mayor. La aceptación depende de evidencia; los tiempos externos no se controlan desde el código.

| Etapa | Duración orientativa | Entregables | Puerta de salida |
| --- | --- | --- | --- |
| **0. Consolidar** | 3–5 días hábiles | Guardar cambios en versión identificable, reconciliar esquema sin reaplicaciones masivas, corregir pruebas/lint, mapa de módulos, ensayo separado y lista de pilotos | Reproducir instalación/compilación; cero fallas en controles acordados; respaldo restaurable |
| **1. Cerrar la operación** | 1–2 semanas | Traslados atómicos, ventas/pagos/recepciones idempotentes, errores visibles, paginación básica, pruebas por rol; onboarding simple | Circuitos 1, 2 y 3 funcionan y sobreviven a reintentos y fallos |
| **2. Conectividad inicial** | 1–2 semanas desde acceso técnico | Primer proveedor fiscal completo, estado y artefactos, cola/reconciliación; validar canal WhatsApp real y corregir campañas | Venta → comprobante aceptado → cliente; mensaje entrante/saliente verificado; cero duplicados en pruebas |
| **3. Piloto comercial** | 1–2 semanas | Tres empresas, acompañamiento, soporte, costos por empresa, cobro del SaaS, exportación, pruebas móviles y de aislamiento | Uso diario, incidencias críticas cerradas, saldos/stock/facturas reconciliados y clientes dispuestos a continuar pagando |
| **4. Producto avanzado** | Después del piloto, por incrementos | Segundo/tercer proveedor, perfiles REST, Brain medido, recordatorios/cobranzas, integraciones de calendario y publicación | Cada incremento reduce tiempo operativo o aumenta retención sin deteriorar margen |

**Ventana de planificación:** aproximadamente 5–8 semanas para un primer paquete vendible bajo estos supuestos. La cobertura avanzada de todos los módulos, todos los proveedores y cualquier REST requiere fases posteriores; no es una promesa de completar toda la suite en ese plazo.

No esperar a terminar la etapa 1 para solicitar documentación comercial/técnica del proveedor y reclutar pilotos. Esa gestión puede avanzar mientras se estabiliza el núcleo. No se realizó ningún contacto en esta revisión.

### Primeras tareas, ordenadas

1. Congelar el alcance comercial inicial y preservar todos los cambios locales.
2. Verificar respaldo/restauración y separar ensayo de operación real.
3. Resolver las tres fallas de pruebas con revisión de privilegios y el error de lint.
4. Reconciliar migraciones y esquema real; registrar procedencia de cambios manuales.
5. Hacer atómicos traslados y robustos los flujos venta/recepción/pago.
6. Corregir errores silenciosos, paginación y métricas incompletas.
7. Endurecer accesos y probar empresa A/empresa B con roles diferentes.
8. Implementar cola/reintentos/reconciliación reutilizables y cerrar los pendientes de Brain.
9. Entregar un proveedor fiscal completo y un canal Meta verificado.
10. Ejecutar piloto con datos reales, límites de alcance y medición de costos.

## 10. Qué vender y cómo mantener eficiencia

**Paquete Operación:** clientes, agenda, catálogo, cotizaciones, ventas, inventario, compras simples, cobros, despacho básico y reportes esenciales. Administración incluida.

**Complemento Conexiones:** proveedor fiscal y mensajería, con costo externo y responsabilidades transparentes. En los primeros pilotos el cliente puede conservar su cuenta de facturación; esto reduce trabajo contractual inicial, siempre que el proveedor permita el uso previsto.

**Complemento Asistente:** búsquedas, resúmenes, sugerencias y borradores con límites de uso. Habilitar acciones sensibles solo después de verificar autorización, aprobación, idempotencia y evidencia del resultado.

RRHH avanzado, publicación automática multicanal, app nativa, conciliación bancaria universal y autonomía amplia no deben bloquear el primer ingreso. Permanecen en la ruta de producto, pero con promesas comerciales acordes a su alcance real.

No fijar precio final sin costos observados. Calcular por empresa: infraestructura + almacenamiento + proveedor fiscal + mensajes + IA + soporte + costo de cobro. Incluir tiempo de incorporación y excepciones. Es preferible un piloto pagado con incorporación asistida y costo claro a vender uso ilimitado que todavía no puede presupuestarse.

Métricas propuestas —objetivos, no resultados observados—:

- Primera operación útil el mismo día de incorporación; configuración ordinaria en menos de 30 minutos, aparte de trámites externos.
- Cero duplicados económicos/fiscales y cero diferencias inexplicadas de stock en los casos de prueba.
- Cada total del dashboard se puede conciliar con sus registros.
- Estado visible para el 100% de trabajos pendientes, fallidos y reintentados.
- Medir latencia p95 con un volumen representativo; objetivo inicial de consultas habituales inferior a dos segundos, excluyendo respuesta externa, a validar en infraestructura real.
- Medir minutos de soporte y costo variable por empresa, costo por acción IA y tiempo ahorrado.
- Para IA: corpus de tareas reales, éxito de tarea, correcciones humanas, errores de permiso, alucinaciones y gasto. Cero acciones fuera de autorización en el conjunto de aceptación.

## 11. Criterio final de autorización comercial

La primera versión está lista cuando una empresa puede incorporarse, importar sus datos, operar los circuitos contratados, recuperarse de fallos y obtener ayuda sin depender de arreglos manuales en la base. Todos los módulos visibles deben indicar con precisión lo disponible, lo pendiente y la configuración requerida.

Para pasar de piloto a venta repetible se necesita además un proceso de restauración ensayado, exportación de datos, soporte con responsabilidades claras, aislamiento verificado, costos controlados y un historial de publicaciones reproducibles.

**Decisión recomendada:** conservar la arquitectura, reducir el alcance de la primera oferta, dedicar el siguiente ciclo a integridad y cierre operativo, conectar un proveedor fiscal y validar tres clientes. Convertir después Brain y las integraciones adicionales en mejoras medibles del negocio, no en condiciones que retrasen indefinidamente el lanzamiento.
