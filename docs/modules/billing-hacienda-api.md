# API Hacienda

El cliente Hacienda queda preparado como interfaz. El cliente por defecto falla
explicitamente para impedir envios falsos.

La configuracion runtime vive en `src/modules/billing/hacienda/config.ts` y
lee solo variables server-side:

- `HACIENDA_ENVIRONMENT=pruebas|produccion`
- `HACIENDA_TEST_AUTH_URL`
- `HACIENDA_TEST_API_URL`
- `HACIENDA_PROD_AUTH_URL`
- `HACIENDA_PROD_API_URL`
- `BILLING_HACIENDA_SEND_ENABLED`
- `BILLING_HACIENDA_STATUS_ENABLED`

Los flags de envio y consulta deben quedar en `false` hasta tener OAuth,
payloads y endpoints reales validados. Si se activan sin URLs completas, el
cliente falla con un mensaje de configuracion incompleta. Si las URLs estan
presentes, todavia falla explicitamente hasta implementar el adaptador
OAuth/payload validado.

La accion `sendFiscalDocumentToHaciendaAction` esta conectada al detalle del
documento fiscal y solo acepta documentos en estado `signed` con un artefacto
`xml_signed` que contenga `Signature`. Mientras no exista cliente OAuth/endpoint
configurado, `NotConfiguredHaciendaClient` falla explicitamente.

Cuando exista cliente real, la accion archivara la respuesta de envio como
`hacienda_response`, actualizara `hacienda_status` solo a `recibido`,
`procesando` o `error`, y dejara `accepted/rejected` para una consulta oficial
posterior. No marca `accepted` en el envio inicial.

La accion `queryFiscalDocumentHaciendaStatusAction` consulta por clave despues
del envio, archiva la respuesta como `hacienda_response` y solo entonces puede
pasar el documento a `accepted`, `rejected`, `processing` o `error_sending`
segun la respuesta del cliente Hacienda real.

La accion `issueFiscalDocumentNowAction` usa `runImmediateFiscalIssuance` como
flujo principal de emision desde el detalle fiscal. Ese flujo ejecuta
validacion, XML, firma, envio y consulta en secuencia, pero se detiene con un
mensaje explicito cuando falta firmador XAdES o cliente Hacienda real. Si el
envio queda en `recibido` o `procesando`, intenta consultar la respuesta oficial
cuando el cliente de consulta esta habilitado; si no, deja el documento en el
estado pendiente correspondiente para reintento manual o recuperacion.

Pendiente para pruebas:

- OAuth/OIDC por ambiente.
- URLs de autenticacion y recepcion desde variables de entorno.
- Envio de XML firmado.
- Consulta por clave con cliente real OAuth/endpoint.
- Mapeo de estados: recibido, procesando, aceptado, rechazado y error.
- Parseo completo de mensajes de rechazo y XML/respuesta oficial.

No se debe marcar `accepted` sin respuesta real de Hacienda.
