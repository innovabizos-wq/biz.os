# Recepcion de documentos fiscales

La base agrega `fiscal_received_documents` para cargar XML de proveedores,
guardar datos parseados, errores de validacion y estado de respuesta receptor.

Estado actual:

- `/facturacion/recepcion` permite pegar un XML recibido.
- `registerReceivedFiscalXmlAction` extrae clave, consecutivo, emisor, fecha,
  moneda y total cuando existen.
- El XML se archiva en `fiscal_received_document_artifacts` con tipo
  `xml_received`, ruta logica y hash SHA-256.
- La descarga usa
  `/api/facturacion/recepcion/[receivedDocumentId]/artefactos/[artifactId]`,
  protegida por sesion, empresa actual y permisos billing.
- Si faltan clave/consecutivo/emisor, el documento queda en estado `error`.
- Si pasa la validacion minima, queda `pending`.
- `prepareReceiverMessageAction` permite preparar un mensaje receptor interno
  como artefacto `receiver_message` para aceptar, aceptar parcialmente o rechazar
  el XML recibido.
- El mensaje receptor preparado se archiva con hash SHA-256 y metadata
  `pendingSignature=true`/`pendingHaciendaSend=true`; no se marca como enviado a
  Hacienda.

Estados:

- `pending`
- `accepted`
- `partially_accepted`
- `rejected`
- `sent`
- `error`

No se debe marcar recepcion como enviada a Hacienda hasta implementar envio real
del mensaje receptor.

Pendiente:

- Validacion XSD oficial del XML proveedor.
- Parseo completo de lineas, impuestos y exoneraciones.
- Asociacion asistida con compras/cuentas por pagar.
- Firma y envio real de mensaje receptor.
