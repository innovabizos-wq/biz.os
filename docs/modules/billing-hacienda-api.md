# API de Hacienda

Biz.OS incluye un cliente directo para los ambientes de pruebas y producción
del API de recepción de comprobantes electrónicos de Costa Rica. La conexión
asignada a cada documento define el ambiente y guarda cifrados el usuario y la
contraseña. Después de asignarla, un cambio en la conexión activa de la empresa
no modifica documentos existentes.

El cliente implementa:

- autenticación OIDC con los clientes oficiales `api-stag` y `api-prod`;
- envío `POST /recepcion` del XML firmado en base64;
- consulta separada `GET /recepcion/{clave}`;
- reutilización temporal del token de acceso;
- límites de tiempo y tamaño de respuesta;
- tratamiento de indisponibilidad y límites del proveedor;
- recuperación por la clave original cuando Hacienda informa que ya recibió
  el documento;
- conservación de la respuesta técnica y del XML oficial final.

Una respuesta satisfactoria al envío solo cambia el documento a recibido o en
proceso. Únicamente una consulta posterior que incluya el XML oficial puede
marcarlo como aceptado o rechazado. Una respuesta final sin ese XML se trata
como error; nunca se presume aceptación.

`issueFiscalDocumentNowAction` ejecuta validación de dominio, construcción,
firma, validación XSD, envío y primera consulta. Si se pierde la respuesta o el
estado sigue incierto, el documento conserva su clave y queda pendiente de
recuperación. El sistema no cambia de proveedor ni vuelve a emitirlo con otra
clave.

Cada envío y consulta carga la conexión guardada en el documento, incluso si
otra conexión pasó a ser la activa. Los documentos heredados que ya alcanzaron
firma o envío sin conservar ese vínculo se bloquean para conciliación manual,
porque asociarlos por la configuración actual podría consultar o emitir con el
proveedor equivocado.

Los artefactos `xml_unsigned`, `xml_signed` y `hacienda_response` se guardan con
hash SHA-256 y rutas privadas. El XML de respuesta final se decodifica y archiva
por separado para descarga y auditoría.

Los interruptores server-side `BILLING_HACIENDA_SEND_ENABLED` y
`BILLING_HACIENDA_STATUS_ENABLED` controlan envío y consulta por separado. El
cliente verifica el interruptor antes de obtener credenciales o hacer una
solicitud externa. Deben permanecer apagados en un ambiente que no esté
autorizado para emitir.

## Activación comercial

La conexión se configura en **Administración → Conexiones → Hacienda**. Antes
de activar producción se requiere:

1. completar el perfil fiscal y la ubicación del emisor;
2. guardar usuario, contraseña, certificado y PIN;
3. probar autenticación y emisión en el ambiente de pruebas;
4. validar factura, tiquete, notas y escenarios de rechazo con datos reales;
5. habilitar producción únicamente después de documentar esos resultados.

Las pruebas locales demuestran construcción, firma y cumplimiento XSD, pero no
certifican la aceptación tributaria. Esa evidencia solo puede obtenerse con
credenciales y certificados válidos contra el servicio externo de Hacienda.
