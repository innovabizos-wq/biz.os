# Conectores fiscales

La pantalla **Administración → Conexiones** distingue una credencial válida de
un contrato de emisión terminado. Una consulta HTTP satisfactoria no basta para
activar un proveedor ni para anunciarlo como compatible.

| Conector | Estado ejecutable | Siguiente requisito comercial |
|---|---|---|
| Hacienda directo | Conexión, firma, emisión y consulta para factura y tiquete | Pruebas aceptadas con cuenta real; cerrar efectos de notas |
| Alegra | Verificación oficial de empresa | Mapeos de cliente, producto, impuesto y numeración; emisión y recuperación |
| GTI | Adaptador 4.4 para factura y tiquete, solicitud/respuesta archivadas y bloqueo de reenvío incierto | Credenciales sandbox, endpoint HTTPS de pruebas y contrato comprobado de consulta/recuperación |
| FacturaProfesional | Verificación solo cuando el operador instala el contrato técnico | Manual privado de la cuenta, sandbox y pruebas completas |
| REST configurable | Emisión y consulta con contrato `bizos-fiscal-v1` | Pruebas de aceptación con el endpoint de cada cliente |
| Tico Factura | Importación por XML | Vinculación asistida con venta y evidencia de estado |

La importacion de Tico Factura valida el XML 4.4, deduplica por clave y huella, conserva el historial del lote y exige confirmacion para vincular una venta. El flujo y sus limites estan documentados en [billing-xml-imports.md](./billing-xml-imports.md).

GTI y FacturaProfesional obtienen sus URLs de variables server-side gestionadas
por el operador de Biz.OS. La empresa cliente solo entrega las credenciales que
exija su contrato. Esto permite una incorporación de pocos pasos cuando el
adaptador ya está instalado y evita que una URL arbitraria se presente como
conector oficial.

## Alcance GTI actual

GTI es el único proveedor externo priorizado en este bloque. Biz.OS ya convierte
el documento canónico al formato 4.4 publicado por el plugin oficial de GTI,
incluyendo cuenta, encabezado, receptor, CABYS, unidades, impuestos, tarifas,
descuentos y medios de pago. La configuración pide número de cuenta, usuario y
contraseña; las credenciales se cifran y nunca se incluyen en los artefactos.

El adaptador utiliza como referencia estable `bizos-{documentId}`, archiva la
solicitud antes de llamar al proveedor y reclama el documento una sola vez. Si
se pierde la respuesta, queda `por confirmar` y no vuelve a emitirlo de forma
automática. Esta decisión evita una duplicación fiscal mientras GTI confirma el
contrato vigente para buscar una operación por esa referencia.

El endpoint de producción proviene del plugin oficial actual. El plugin publica
un endpoint de pruebas por HTTP; Biz.OS no enviará credenciales por esa ruta.
Por eso `GTI_TEST_DOCUMENT_URL` debe contener el endpoint HTTPS entregado por
GTI. La conexión permanece verificada pero no activa hasta completar una
emisión sandbox, recuperar su estado y descargar sus artefactos.

Fuentes de implementación: [servicio oficial GTI](https://www.facturaelectronica.cr/ServicioCargaFactura/),
[plugin oficial](https://wordpress.org/plugins/gti-factura/) y
[manual oficial de integración](https://cdn.gticr.com/gticr/Documentos/Documentacion_Plugin.pdf).

El perfil REST requiere que su hostname exista en
`BILLING_REST_ALLOWED_HOSTS`. También bloquea redes privadas, URLs con
credenciales, redirecciones y headers sensibles. La verificación consume como
máximo 250 KB y no ejecuta código suministrado por el cliente. Solo se activa si
el servicio declara el contrato `bizos-fiscal-v1` y confirma emisión, consulta e
idempotencia. Las respuestas operativas admiten hasta 1 MB y se archivan con
hash; el detalle técnico está en `billing-rest-connector.md`.

La migración `20260914130000_fiscal_connector_capability_truth.sql` corrige las
capacidades declaradas y devuelve a estado `verified` cualquier conexión que
una versión anterior hubiera marcado activa solo por responder a una consulta.
No elimina credenciales ni conexiones.

La migración `20260914141000_rest_fiscal_contract.sql` agrega la capacidad REST
ejecutable y el tipo de artefacto neutral `provider_response`. Las conexiones
REST ya guardadas deben verificarse otra vez para demostrar el handshake antes
de quedar activas.

## Proveedor fijo por documento

Antes de reservar la identidad fiscal, Biz.OS vincula el documento con la
conexión activa del mismo ambiente. Guarda el identificador de conexión,
proveedor, ambiente y fecha de asignación. Esos datos no pueden editarse
después, y una conexión que ya pertenece a documentos no puede convertirse en
otro proveedor ni cambiar de ambiente.

Firma, envío, consulta y recuperación cargan las credenciales mediante ese
identificador fijo. Por tanto, activar un proveedor nuevo solo afecta a los
documentos futuros. Un documento antiguo ya firmado o enviado que no conserve
la conexión de origen se detiene para conciliación manual; el sistema no la
deduce a partir de la conexión activa actual.

La identidad externa, referencia, estado y fecha de la última respuesta se
guardan junto al documento. La restricción única por empresa y proveedor evita
asociar la misma identidad externa a dos documentos económicos.
