# XML 4.4

La estructura inicial define tipos y builder basico para documentos emisores
principales. La validacion XSD oficial sigue pendiente.

No se debe afirmar que un XML esta validado contra Hacienda si no se ejecuto
validacion contra XSD oficial y pruebas del Ministerio de Hacienda.

Tipos preparados:

- Factura electronica
- Tiquete electronico
- Nota de credito
- Nota de debito
- Factura compra, exportacion, recibo electronico y mensaje receptor como
  placeholders explicitos.

## Generacion controlada

La accion `generateFiscalDocumentXmlAction` solo genera un XML sin firmar cuando
el documento interno esta en estado `validated`. Si el documento aun no tiene
`clave` y `consecutivo`, la accion reserva un consecutivo fiscal por empresa,
ambiente, sucursal, terminal y tipo documental, genera una clave numerica de 50
digitos y la asigna al documento antes de construir el XML.

La clave usa:

- codigo pais `506`
- fecha de emision `ddmmyy`
- identificacion del emisor normalizada a 12 digitos
- consecutivo fiscal de 20 digitos
- situacion normal `1`
- codigo de seguridad numerico de 8 digitos

El XML generado incluye encabezado fiscal, emisor, receptor cuando aplica,
detalle de servicio, impuestos por linea y resumen de factura desde las tablas
`fiscal_document_lines` y `fiscal_document_line_taxes`.

El XML generado se guarda como artefacto interno en
`fiscal_document_artifacts` con tipo `xml_unsigned`, hash SHA-256, ruta logica y
metadata `pendingXsdValidation=true`. Este artefacto no implica firma, envio ni
aceptacion por Hacienda.

La validacion XSD queda conectada mediante
`validateFiscalXmlAgainstOfficialXsd`. Con
`BILLING_XML_VALIDATION_ENABLED=false`, la generacion continua pero el artefacto
queda con `pendingXsdValidation=true`. Con el flag en `true`, la accion exige un
validador real contra XSD oficial 4.4; si no existe o retorna errores, el
documento pasa a `error_xml`, guarda `validation_errors` y no archiva XML como
generado.

Antes de generar el XML, `validateFiscalDocumentReadyForXml` vuelve a validar
server-side:

- clave y consecutivo fiscal
- sucursal, terminal y datos fiscales del emisor
- receptor cuando corresponde a factura electronica
- total del comprobante
- consistencia entre totales del documento y suma de lineas/impuestos
- lineas fiscales existentes
- CABYS por linea
- montos de linea
- detalle de impuestos para lineas gravadas

Si alguna validacion falla, el documento vuelve a `error_validation`, se guardan
`validation_errors` y no se genera artefacto XML.

Estados permitidos despues de esta accion:

- `fiscal_documents.status = xml_generated`
- `fiscal_documents.hacienda_status` permanece `no_enviado`

Pendiente para emision real:

- estructura XML 4.4 completa validada contra XSD oficial
- adaptador de validacion XSD oficial para `BillingXmlValidator`
- firma XAdES-EPES
- envio y consulta contra API Hacienda
- registro de respuesta oficial
