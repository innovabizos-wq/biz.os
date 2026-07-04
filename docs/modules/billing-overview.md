# Facturacion electronica

El modulo `billing` prepara la base fiscal de biz.os para Costa Rica. Una factura
electronica real no es un PDF: es el XML valido, firmado y aceptado por
Hacienda. El PDF es solo la representacion grafica.

## Estado actual

- Configuracion fiscal heredada en `/admin/fiscal`.
- Ruta operativa `/facturacion` y subrutas protegidas por modulo activo y permisos.
- Base de datos preparada para configuracion fiscal estructurada, CABYS,
  documentos fiscales internos, consecutivos, recepcion y entregas.
- Preparacion de documento fiscal interno desde venta confirmada mediante
  `prepare_fiscal_document_from_sale`, con snapshots, totales, validaciones y
  eventos.
- Emision fiscal inmediata desde el detalle del documento mediante
  `issueFiscalDocumentNowAction` y `runImmediateFiscalIssuance`: ejecuta en
  orden identidad fiscal, validacion, XML 4.4, firma, envio y consulta hasta el
  ultimo paso disponible.
- Emision desde cotizaciones/ventas conectada al mismo flujo: `issueInvoiceFromSaleAction`
  prepara `fiscal_documents` con `prepare_fiscal_document_from_sale` y luego
  ejecuta `runImmediateFiscalIssuance`.
- Cotizaciones detecta facturas desde `fiscal_documents` mediante
  `getInvoicesForSales`, y usa `facturas_electronicas` solo como fallback
  heredado. Esto evita reemitir una venta que ya tiene documento fiscal activo.
- Cuando la factura viene de `fiscal_documents`, cotizaciones enlaza al detalle
  `/facturacion/documentos/[documentoId]` para continuar firma, envio,
  consulta, PDF y archivo.
- Firma XAdES-EPES y cliente Hacienda quedan como interfaces que fallan
  explicitamente hasta tener implementacion real.

## Flujo objetivo

Venta confirmada -> documento fiscal interno -> validacion -> XML 4.4 ->
firma XAdES-EPES -> envio Hacienda -> respuesta oficial -> PDF/archivo/entrega.

No se debe marcar un documento como `accepted` sin respuesta real de Hacienda.
El flujo inmediato tampoco marca `signed` sin `Signature` real ni envia a
Hacienda sin cliente server-side configurado.
