# Motor de impuestos fiscal

El motor inicial calcula linea y totales de documento con cantidades, precio,
descuento, exento, no sujeto y tarifa configurada. No inventa catalogos
oficiales: las tarifas deben venir de los catalogos fiscales o del perfil fiscal
del producto.

`validateFiscalDocumentReadyForXml` recalcula totales desde
`fiscal_document_lines` antes de generar XML y bloquea si no coinciden:

- `totalImpuestos`
- `totalVentaNeta`
- `totalComprobante`

La tolerancia actual es pequena para absorber redondeos, pero no permite emitir
XML con impuestos o totales desbalanceados. Esta validacion usa la empresa actual
y las lineas fiscales ya preparadas; no recalcula desde datos enviados por el
frontend.

Antes de produccion se deben ampliar pruebas para IVA, exoneraciones, moneda
extranjera, otros cargos y resumen XML 4.4 completo.
