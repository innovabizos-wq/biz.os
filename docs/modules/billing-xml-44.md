# XML 4.4

Biz.OS construye documentos emisores con el orden, namespaces y campos del
anexo XML 4.4 de Costa Rica. La implementación actual cubre los tipos `01`,
`02`, `03` y `04`:

- factura electrónica;
- nota de débito electrónica;
- nota de crédito electrónica;
- tiquete electrónico.

El flujo comercial disponible prepara facturas y tiquetes desde ventas. Los
builders y esquemas de notas de crédito y débito están implementados, pero la
liberación comercial de esos documentos todavía requiere cerrar la operación
completa de devolución, referencia, saldo e inventario y validarla en el
ambiente de pruebas de Hacienda. Factura de compra, exportación, recibo
electrónico de pago y mensajes receptores conservan flujos separados y no se
deben presentar como emisores terminados.

## Construcción y datos conservados

`generateFiscalDocumentXmlAction` reserva, cuando hace falta, un consecutivo
único por empresa, ambiente, sucursal, terminal y tipo documental. Luego genera
una clave numérica de 50 dígitos con país `506`, fecha, identificación del
emisor, consecutivo, situación y código de seguridad.

El documento mantiene una instantánea de los datos usados al emitir:

- emisor, ubicación e identificación del proveedor del sistema;
- receptor y tipo de identificación fiscal;
- condición de venta y plazo de crédito;
- moneda y tipo de cambio;
- CABYS, códigos comerciales, cantidades, precios y descuentos;
- impuestos, base imponible y totales;
- formas de pago y referencias.

Los cambios posteriores al catálogo, al cliente o a la empresa no reescriben
el documento histórico.

## Validación oficial incorporada

Los XSD 4.4 de factura, tiquete, nota de crédito y nota de débito están
versionados en `src/modules/billing/xml/schemas/2024/v4.4`. La firma XML usa el
esquema W3C incluido en `src/modules/billing/xml/schemas/2024`.

`validateFiscalXmlAgainstOfficialXsd` ejecuta libxml2 mediante `xmllint-wasm`.
La validación es obligatoria y no se puede desactivar con una variable de
entorno. El validador:

- limita el XML a 2 MB;
- rechaza declaraciones DTD y ENTITY;
- comprueba raíz y namespace 4.4;
- devuelve hasta 20 errores con número de línea;
- impide archivar o enviar un XML firmado que no cumpla el XSD.

El XML sin firmar se conserva como `xml_unsigned` y queda pendiente de firma.
Después de crear la firma XAdES, el XML completo se valida contra el XSD. Solo
entonces se archiva como `xml_signed` y el documento pasa a `signed`. Antes de
enviar se repite la validación para detectar corrupción o sustitución del
artefacto.

Las pruebas automatizadas generan una factura con el builder real de Biz.OS,
la firman con un certificado PKCS#12 de prueba, verifican criptográficamente la
firma y la validan contra el XSD incluido. Esta prueba técnica no reemplaza la
aceptación de documentos con una cuenta real en el ambiente de pruebas de
Hacienda.

## Requisitos para emitir

Antes de construir el XML, el servidor verifica datos fiscales del emisor,
ubicación, proveedor del sistema, receptor cuando corresponde, CABYS, detalle
de impuestos, moneda, pagos, líneas y consistencia de totales. Un documento
incompleto queda en `error_validation`; un XML inválido queda en `error_xml`.
Ninguno puede firmarse o enviarse.
