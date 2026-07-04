# PDF fiscal

El PDF fiscal es representacion grafica, no la factura real.

Debe generarse desde el documento fiscal y mostrar estado claro:

- Pendiente de aceptacion cuando no exista respuesta aceptada.
- Rechazado cuando Hacienda rechace.
- Aceptado solo con respuesta oficial.

Estado actual:

- `generateFiscalPdfRepresentationAction` genera una representacion grafica HTML
  imprimible y la archiva como artefacto `pdf_representation`.
- El artefacto incluye una nota visible: la factura electronica real es el XML
  firmado y aceptado por Hacienda.
- No se marca el documento como aceptado por generar esta representacion.
- `registerFiscalDocumentDeliveryAction` registra descarga o entrega manual en
  `fiscal_document_deliveries`, sin enviar correos automaticos.

Pendiente:

- Renderer PDF binario real.
- Almacenamiento final del PDF en bucket privado/controlado.
- Correo fiscal con XML/PDF adjuntos.
- Descargas seguras por URL firmada o proxy server-side.

## Descarga protegida

La ruta `/api/facturacion/documentos/[documentoId]/artefactos/[artifactId]`
sirve artefactos emitidos desde el servidor. Valida sesion, empresa actual,
modulo billing y permisos antes de devolver el contenido como `attachment`.

No se exponen URLs publicas de almacenamiento ni contenido XML/PDF en Platform
Console.
