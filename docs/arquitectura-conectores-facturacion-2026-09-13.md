# Biz.OS: conectores de facturación y API REST

Propuesta de implementación — 13 de septiembre de 2026.

Este anexo acompaña al diagnóstico integral. Describe trabajo futuro; **los conectores aquí propuestos no están implementados por la elaboración del informe**.

## 1. Objetivo y decisión

Una empresa debe trabajar en Biz.OS y utilizar su proveedor fiscal sin duplicar la digitación. El sistema conserva ventas, cobros, inventario y clientes; un adaptador convierte el documento comercial al contrato del proveedor y devuelve estado fiscal y archivos.

Primero entregar **un conector completo**. GTI tiene prioridad por el requerimiento del proyecto. Solicitar su contrato técnico y acceso de pruebas desde el inicio; si no están disponibles a tiempo, acordar una salida con FacturaProfesional/ComprobantesElectronicosCR u otro proveedor documentado y mantener GTI como compromiso de la siguiente entrega. No presentar una tarjeta de GTI como conectada sin haber probado emisión, consulta y documentos.

Conectar otro proveedor no debe exigir reescribir ventas ni los componentes visuales de facturación. Tampoco debe activar el motor fiscal directo de Biz.OS si el proveedor ya genera y firma el XML.

## 2. Experiencia de conexión

Pantalla propuesta: **Configuración → Conexiones → Facturación**.

Tarjetas: GTI, FacturaProfesional, Alegra, Hacienda directo, Tico Factura y API REST. Cada una identifica explícitamente si está disponible, en pruebas, por configurar o disponible mediante importación.

Recorrido:

1. **Elegir proveedor.** Mostrar requisitos, costo externo y operaciones cubiertas.
2. **Autorizar o conectar.** Usar autorización delegada si existe oficialmente; de lo contrario, pedir solamente las credenciales/cuenta exigidas por su contrato, una vez. No asumir que todos ofrecen OAuth.
3. **Verificar empresa.** Confirmar emisor, entorno, sucursal, terminal, moneda y política de numeración; prellenar lo verificable.
4. **Probar.** Validar credenciales con una operación de lectura. Probar emisión únicamente en el entorno de pruebas; jamás emitir un documento fiscal real como prueba silenciosa de conexión.
5. **Activar.** Mostrar capacidades y última prueba. La cuenta queda utilizable desde ventas.

Después: el usuario abre una venta, revisa receptor e importes y pulsa **Emitir comprobante**. Biz.OS muestra “En proceso”, y después aceptación o rechazo con su razón y archivos. El envío al cliente queda registrado por separado.

Un clic inicia y luego ejecuta la conexión preconfigurada. No elimina el alta tributaria, la contratación del proveedor o una autorización exigida por este. Para clientes con poca experiencia, la plataforma puede ofrecer incorporación asistida.

## 3. Diferenciar las cuatro integraciones

| Integración | Para qué sirve | Qué debe hacer Biz.OS |
| --- | --- | --- |
| Proveedor fiscal externo | Generación/firma/envío y servicios acordados con el proveedor | Entregar datos correctos, interpretar resultados, conservar evidencia y recuperar fallos |
| API oficial de recepción de Hacienda | Recibir XML preparado y consultar respuesta | Generar y validar XML, firmar, autenticar, enviar y operar todo el ciclo |
| API pública de consulta de Hacienda | Contribuyentes, catálogos, tipos de cambio y otras consultas documentadas | Consultar responsablemente, respetar límites y mantener caché vigente |
| Tico Factura gratuito | Emitir usando la aplicación de Hacienda en OVi | Mientras no exista contrato de integración confirmado, coexistir mediante importación/registro de comprobantes externos |

[API oficial de comprobantes](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html), [API de consulta](https://api.hacienda.go.cr/docs), [acceso al facturador gratuito](https://www.hacienda.go.cr/docs/FacturadorGratuitoTICOFACTURADisponibleAPartirdel06deoctubre.pdf).

No automatizar la interfaz de OVi como dependencia de emisión del producto. Un enlace de acceso no es una integración y un archivo importado no confirma automáticamente aceptación.

## 4. Arquitectura mínima

```text
Venta / compra / cobro
        │
        ▼
Documento fiscal canónico e inmutable al enviar
        │
        ▼
Orden persistente de emisión + clave idempotente
        │
        ▼
Trabajador de integración
        ├── Adaptador GTI
        ├── Adaptador FacturaProfesional
        ├── Adaptador Alegra
        ├── Adaptador REST configurado
        └── Adaptador Hacienda directo, cuando esté completo
        │
        ▼
Consulta / notificación → estado oficial → archivos → entrega
```

Mantener el núcleo modular y Supabase. Reutilizar el mecanismo durable existente si supera pruebas de reanudación, identidad y tiempos; no agregar dos motores de cola para resolver el mismo problema sin una necesidad concreta.

Contrato conceptual de cada adaptador:

| Operación | Resultado requerido |
| --- | --- |
| `validateConnection` | Emisor/cuenta y entorno verificados; permisos disponibles; errores redactados |
| `getCapabilities` | Tipos de documento y operaciones realmente soportadas por esa cuenta |
| `submitDocument` | ID externo, estado inicial, clave/consecutivo si existen y respuesta técnica |
| `findByExternalReference` | Recuperar emisión por referencia estable después de un timeout, cuando el proveedor lo soporte |
| `getDocumentStatus` | Estado normalizado, estado original, detalle y momento de consulta |
| `downloadArtifacts` | XML firmado, respuesta oficial y PDF si el proveedor lo ofrece |
| `processWebhook` | Evento autenticado, correlacionado y deduplicado según el mecanismo disponible |
| `submitReceiverMessage` | Solo si lo soporta el contrato: aceptación/rechazo de documentos recibidos |

Emitir notas de crédito/débito mediante documentos referenciados; no borrar una factura enviada para simular una anulación. El conjunto aplicable debe validarlo el proveedor y el responsable fiscal del negocio.

## 5. Datos que hay que conservar

Reutilizar `fiscal_documents`, líneas, impuestos, referencias, artefactos, eventos y entregas. Antes de agregar tablas o columnas, reconciliar el esquema existente.

Extensiones propuestas:

- **Conexiones por empresa:** proveedor, entorno, versión del adaptador, referencia al secreto, cuenta externa, capacidades, salud, fecha de prueba y vencimiento de credencial.
- **Mapeos de identidades:** cliente, producto, impuestos, sucursal y terminal de Biz.OS frente al identificador externo. Obligatorio cuando el proveedor requiera catálogos propios, como puede ocurrir en una integración contable.
- **Orden de integración:** documento, conexión, operación, clave idempotente, hash de contenido, intentos, próximo intento, propietario temporal del trabajo y expiración de la reserva.
- **Resultado externo:** ID del proveedor, clave, consecutivo, estado oficial, respuesta original redactada y marcas de tiempo.
- **Archivos:** tipo, hash, ubicación privada, tamaño, origen y fecha. Mantener copia exportable según obligaciones y contrato, además del vínculo externo.

Separar entorno de pruebas/producción en conexiones, numeración, documentos y archivos. Un documento debe recordar el proveedor y la versión con que se emitió aunque la empresa cambie después de servicio.

El documento canónico debe incluir emisor/receptor, actividad cuando corresponda, líneas y CABYS, unidades, cantidades, precios, descuentos, impuestos, exoneraciones, moneda/tipo de cambio, condición de venta, medios de pago y referencias. Preservar la instantánea utilizada; una edición posterior del producto o cliente no cambia el comprobante histórico.

Usar precisión decimal acordada y validada. El importe enviado, el que contabiliza Biz.OS y el que devuelve el proveedor deben conciliar; no ajustar silenciosamente diferencias de redondeo.

## 6. Numeración y prevención de duplicados

Por conexión debe estar definido **quién asigna el consecutivo y la clave**. Si lo hace el proveedor, Biz.OS no reserva además un consecutivo local independiente. Si corresponde a Biz.OS, la reserva y asignación al documento requieren atomicidad y exclusión concurrente.

Para un mismo documento lógico, mantener una referencia estable y una clave idempotente. Si llega de nuevo la misma clave con otro contenido, devolver conflicto. No crear una clave nueva en cada reintento automático.

Caso crítico: el proveedor acepta la factura pero se corta la conexión antes de devolver la respuesta. Biz.OS debe consultar por la referencia existente, o mantener “resultado por confirmar” y escalar si el proveedor no permite recuperar de forma segura. **No reenviar a otro proveedor por un timeout**: podría generar dos comprobantes.

El cambio de proveedor se aplica a futuras emisiones con la numeración acordada. Los documentos anteriores conservan proveedor, trazabilidad y consulta histórica. La importación de documentos de Tico Factura u otros sistemas debe deduplicar por emisor/clave y distinguir venta interna ya registrada de nueva venta para no duplicar ingresos.

## 7. Estados y recuperación

Estados propuestos para el flujo de integración: borrador → validado → en cola → enviando → recibido por proveedor/procesando → aceptado o rechazado. Agregar “resultado por confirmar” para respuestas inciertas y “requiere intervención” para errores que no puede resolver el sistema.

Estos estados deben mapearse a los del esquema actual, no añadirse como una segunda verdad paralela. Mantener por separado:

- Estado comercial de la venta.
- Estado fiscal oficial del comprobante.
- Estado de cobro.
- Estado de despacho.
- Estado de entrega del documento al cliente.

Un HTTP 200/202 indica recepción técnica según el contrato, no necesariamente aceptación fiscal. Para la conexión directa a Hacienda, su API documenta recepción y consulta como operaciones distintas. [Especificación oficial](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html).

Reintentar solo errores transitorios con espera progresiva y dispersión temporal; respetar límites del proveedor. Errores de datos, credenciales o rechazo oficial requieren corrección específica. Recibir eventos repetidos o fuera de orden no debe retroceder un documento aceptado a “enviado”.

Pantalla de operador: cola, antigüedad, intentos, última respuesta, motivo de bloqueo y próxima acción. Añadir reconciliación periódica para recuperar notificaciones perdidas. Toda intervención debe quedar auditada.

## 8. API REST: dos necesidades diferentes

**REST saliente:** conectar Biz.OS con el facturador de un cliente. Necesita URL base autorizada, autenticación, rutas de emisión/consulta/descarga, mapeo de campos y estados, esquema de errores y política de recuperación. Un formulario de URL y token no resuelve diferencias de contrato.

Propuesta eficiente: admitir al inicio plantillas verificadas y un perfil REST empresarial configurado por un administrador técnico. Permitir mapeos declarativos limitados; no ejecutar código arbitrario suministrado por el cliente.

**REST entrante:** permitir que una tienda, POS u otro sistema utilice Biz.OS. Propuesta futura `/api/v1`: crear/consultar documentos, recuperar archivos y consultar capacidades. Entregar especificación OpenAPI, claves con permisos mínimos, autenticación por empresa, paginación, errores estables y ejemplos de pruebas. La clave resuelve la empresa; el cuerpo no concede autoridad sobre un `empresa_id` libre.

Para ambas: TLS, secretos cifrados, rotación, límites por empresa, validación de cuerpos, tiempos máximos y registros sin credenciales. Para URLs configurables, impedir accesos a redes privadas, direcciones de metadatos y redirecciones no aprobadas; aplicar el mismo control a descargas de artefactos. Verificar firma de webhooks si existe; si no, autenticar según contrato y consultar al proveedor antes de confiar en un cambio sensible.

No bloquear el primer piloto por construir una plataforma universal de integraciones. La API entrante y el perfil REST completo pueden seguir al primer conector, conservando desde el inicio un modelo de datos compatible.

## 9. Cobertura fiscal y mantenimiento

La primera versión debe declarar tipos de documento, monedas, impuestos y operaciones que realmente soporta. Factura, tiquete y nota de crédito suelen ser un conjunto inicial útil; agregar débito, compra, exportación, REP y mensajes receptores conforme al segmento contratado y reglas aplicables. Si un piloto necesita una operación fiscal no cubierta, esa operación pasa a ser requisito de su lanzamiento.

No equiparar “tengo el código del tipo en la tabla” con emitirlo correctamente. Probar cada tipo ofrecido y sus referencias, descuentos, exoneraciones, precios e impuestos incluidos, decimales y cambios de moneda que entren en el contrato comercial.

Los nuevos códigos del anexo 4.4 publicados por Hacienda deben estar cubiertos para el 1 de noviembre de 2026. Usar versiones identificables de catálogos, datos de prueba y comprobaciones del adaptador antes de actualizar producción. [Comunicado oficial](https://www.hacienda.go.cr/docs/ActualizacionAnexosyEstructurasVersion4.4CEv2.pdf).

## 10. Pruebas para declarar un conector listo

| Caso | Resultado exigido |
| --- | --- |
| Credenciales válidas/incorrectas/expiradas | Estado de conexión correcto y secreto nunca visible |
| Empresa equivocada o usuario sin permiso | Sin lectura ni emisión cruzada |
| Emisión normal | Documento aceptado con ID, clave y archivos recuperables |
| Doble clic o reintento | Un solo documento fiscal |
| Timeout después de emisión | Recuperación del documento original sin duplicado |
| Webhook repetido/fuera de orden | Estado consistente y evento deduplicado |
| Notificación perdida | Consulta posterior recupera el resultado |
| Proveedor no disponible | Trabajo persistido, espera y reintento visibles |
| Datos rechazados | Razón legible, sin loop de reenvíos inútiles |
| Corrección por nota | Referencia al documento original y saldos correctos |
| Devolución parcial | Efectos fiscales, financieros y de inventario separados y trazables |
| Cambio de proveedor | Nuevos documentos en la nueva conexión; anteriores conservan trazabilidad |
| Importación Tico Factura | Archivo conservado, clave deduplicada y venta vinculada sin doble ingreso |
| Caída durante descarga o envío al cliente | Archivo/entrega recuperables; no se reemite la factura |
| Documento multimoneda o especial ofrecido | Valores conciliados con proveedor y revisión fiscal |

Guardar evidencia de pruebas y la versión del contrato del proveedor. La aceptación en pruebas demuestra integración técnica; la puesta en producción requiere además cuenta habilitada, condiciones comerciales y verificación de los casos fiscales contratados.

## 11. Dependencias que hay que resolver fuera del código

Con GTI y los demás candidatos: contrato vigente de API, acceso y límites del entorno de pruebas, tipos admitidos, autenticación, propiedad de numeración, búsqueda por referencia, webhooks, archivos, cuotas, costo de integración, autorización multiempresa/reventa, soporte y política de cambios.

El manual público de GTI demuestra un flujo de integración con cuenta/usuario/contraseña y un entorno de pruebas que se solicita al proveedor; no permite inferir todos los detalles de la API actual. [Manual GTI](https://cdn.gticr.com/gticr/Documentos/Documentacion_Plugin.pdf).

FacturaProfesional identifica su API de integración mediante ComprobantesElectronicosCR. Alegra publica endpoints de creación/consulta con cobertura Costa Rica. Confirmar condiciones comerciales y cobertura efectiva en cada cuenta antes de anunciar compatibilidad. [FacturaProfesional](https://www.facturaprofesional.com/landings/version-4-4), [ComprobantesElectronicosCR](https://www.comprobanteselectronicoscr.com/), [Alegra](https://developer.alegra.com/reference/get_invoices-id).

La mejor ruta es resolver estos requisitos una vez por proveedor y convertirlos en una incorporación repetible para cada empresa, manteniendo todos los procesos comerciales en Biz.OS.
