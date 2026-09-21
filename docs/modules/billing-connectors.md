# Conectores fiscales

La pantalla **Administración → Conexiones** distingue una credencial válida de
un contrato de emisión terminado. Una consulta HTTP satisfactoria no basta para
activar un proveedor ni para anunciarlo como compatible.

| Conector | Estado ejecutable | Siguiente requisito comercial |
|---|---|---|
| Hacienda directo | Conexión, firma, emisión y consulta para factura y tiquete | Pruebas aceptadas con cuenta real; cerrar efectos de notas |
| Alegra | Verificación oficial de empresa | Mapeos de cliente, producto, impuesto y numeración; emisión y recuperación |
| GTI | Verificación solo cuando el operador instala el contrato técnico | Contrato vigente, sandbox, payloads, estados, archivos e idempotencia |
| FacturaProfesional | Verificación solo cuando el operador instala el contrato técnico | Manual privado de la cuenta, sandbox y pruebas completas |
| REST configurable | Emisión y consulta con contrato `bizos-fiscal-v1` | Pruebas de aceptación con el endpoint de cada cliente |
| Tico Factura | Importación por XML | Vinculación asistida con venta y evidencia de estado |

La importacion de Tico Factura valida el XML 4.4, deduplica por clave y huella, conserva el historial del lote y exige confirmacion para vincular una venta. El flujo y sus limites estan documentados en [billing-xml-imports.md](./billing-xml-imports.md).

GTI y FacturaProfesional obtienen sus URLs de variables server-side gestionadas
por el operador de Biz.OS. La empresa cliente solo entrega las credenciales que
exija su contrato. Esto permite una incorporación de pocos pasos cuando el
adaptador ya está instalado y evita que una URL arbitraria se presente como
conector oficial.

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
