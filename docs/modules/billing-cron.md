# Cron de facturacion

Estado actual: no existe un cron de facturacion configurado en `vercel.json`.

El unico cron Vercel actual es:

- path: `/api/whapp/campanas/despachar`
- schedule: `0 6 * * *`
- modulo: Whapp campanas
- funcion: `dispatchInboxCampaignBatch`
- proposito: recuperacion/reintento diario compatible con Vercel Hobby

No ejecuta estados de Hacienda, no procesa `fiscal_documents`, no actualiza
facturas aceptadas/rechazadas y no limpia documentos fiscales temporales.

La logica critica de facturacion se ejecuta desde acciones server-side
inmediatas:

- `prepareFiscalDocumentFromSaleAction`: prepara documento fiscal interno desde
  venta.
- `issueInvoiceFromSaleAction`: al emitir desde cotizaciones/ventas prepara
  `fiscal_documents` y ejecuta inmediatamente `runImmediateFiscalIssuance`; no
  depende de cron.
- `issueFiscalDocumentNowAction`: camino principal de emision inmediata desde el
  detalle fiscal; llama `runImmediateFiscalIssuance` y avanza validacion, XML,
  firma, envio y consulta hasta el ultimo paso real disponible.
- `generateFiscalDocumentXmlAction`: valida datos, asigna clave/consecutivo,
  genera XML y aplica validacion XSD si el flag esta habilitado.
- `signFiscalDocumentXmlAction`: firma solo si existe firmador real y el XML
  contiene `Signature`.
- `sendFiscalDocumentToHaciendaAction`: envia solo XML firmado real.
- `queryFiscalDocumentHaciendaStatusAction`: consulta estado Hacienda y solo
  aqui puede pasar a `accepted` o `rejected` con respuesta real.

Ademas existe recuperacion manual autenticada desde `/facturacion/reportes`:

- funcion: `recoverPendingFiscalDocuments`
- action: `recoverPendingFiscalDocumentsAction`
- log: `[billing-fiscal-recovery]`
- alcance: empresa actual, modulo billing activo y permisos billing
- comportamiento: revisa documentos pendientes/temporales, pero solo consulta
  Hacienda para documentos `sent`/`processing` o con estado Hacienda
  `recibido`/`procesando`
- no genera XML, no firma XML y no envia XML automaticamente

Si se agrega un cron fiscal futuro, debe quedar como recuperacion/reintento, no
como camino principal de emision. Solo deberia revisar documentos en estados
pendientes o temporales equivalentes a:

- `validated`
- `xml_generated`
- `signed`
- `sent`
- `processing`
- `error_xml`
- `error_signing`
- `error_sending`

El cron fiscal futuro debe registrar cuantos documentos reviso y cuantos
actualizo, y nunca debe marcar `accepted` sin respuesta real de Hacienda.
