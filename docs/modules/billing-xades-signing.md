# Firma XAdES-EPES

Biz.OS incluye un firmador XAdES-EPES server-side para certificados PKCS#12.
La implementación está en `src/modules/billing/signing/pkcs12.ts` y se obtiene
mediante `HaciendaPkcs12BillingXmlSigner`.

El firmador:

- abre el certificado `.p12` con su PIN;
- exige una llave privada RSA y un certificado X.509 vigente;
- comprueba que certificado y llave privada correspondan;
- genera una firma enveloped XAdES-EPES con RSA-SHA256;
- incorpora la política fiscal configurada para comprobantes 4.4;
- exige exactamente una firma y la verifica criptográficamente antes de
  devolver el XML.

El certificado y el PIN se cargan solo en el servidor desde la conexión activa
de Hacienda. Los secretos permanecen cifrados y nunca se devuelven a la
interfaz. Existe una lectura heredada cifrada para instalaciones anteriores.

`signFiscalDocumentXmlAction` requiere un artefacto `xml_unsigned`, ejecuta la
firma, comprueba el nodo `Signature` y valida el XML firmado contra el XSD 4.4.
Solo un resultado válido se guarda como `xml_signed` y cambia el documento a
`signed`. Una contraseña incorrecta, un certificado vencido, una firma no
verificable o un XML inválido dejan un error explícito y no producen un
documento aparentemente firmado.

La prueba automatizada cubre apertura de PKCS#12, firma, verificación y XSD con
un certificado de prueba. Antes de habilitar una empresa en producción se debe
repetir el recorrido con su certificado real y emitir documentos en el
ambiente de pruebas de Hacienda.
