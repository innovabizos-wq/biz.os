# Firma XAdES-EPES

La firma debe ejecutarse solo server-side. El modulo incluye la interfaz
`BillingXmlSigner` y una implementacion `NotConfiguredBillingXmlSigner` que
falla explicitamente.

Estado actual: firma real pendiente.

La accion `signFiscalDocumentXmlAction` esta conectada al detalle del documento
fiscal, valida que existe un XML sin firmar archivado y llama a
`getBillingXmlSigner()`. La implementacion por defecto sigue fallando
explicitamente con `NotConfiguredBillingXmlSigner`.

Cuando exista un firmador real, la accion solo marcara el documento como
`signed` si el XML devuelto contiene `Signature`; entonces archivara
`xml_signed` con hash SHA-256 y ruta logica. Sin firma real no cambia el estado
del documento ni genera un artefacto firmado.

Falta decidir e implementar una estrategia:

- Libreria Node compatible.
- Microservicio firmador aislado.
- Proveedor externo de firma.
- Implementacion propia validada con XML 4.4 y certificados reales.

No se debe devolver XML sin firma como si estuviera firmado.
