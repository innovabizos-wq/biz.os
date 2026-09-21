# Importacion fiscal XML

Biz.OS admite comprobantes XML 4.4 producidos fuera del sistema. Esta via cubre exportaciones de Tico Factura, cargas manuales y perfiles REST sin afirmar que existe una integracion privada con el proveedor.

## Flujo disponible

1. El usuario elige el origen y declara si el comprobante es una compra recibida o una venta emitida por su empresa.
2. La vista previa analiza el XML con un DOM que no resuelve DTD ni entidades, limita el archivo a 2 MB y valida la raiz, namespace y campos fiscales.
3. El documento debe superar el XSD oficial 4.4 incluido en el proyecto.
4. Biz.OS comprueba la identidad fiscal: el receptor debe ser la empresa para compras entrantes y el emisor debe ser la empresa para ventas externas.
5. La clave y la huella SHA-256 se comparan con los documentos archivados. Un reintento conserva un lote marcado como duplicado y no crea otro documento.
6. Al confirmar, una funcion transaccional guarda el lote, el documento y el XML original. Si alguna escritura falla, no queda una importacion parcial.

## Vinculacion con ventas

Para archivos salientes, Biz.OS sugiere una venta cuando fecha, moneda y total producen una coincidencia unica. La vinculacion requiere eleccion humana. La base de datos vuelve a comprobar que la venta pertenece a la empresa y que moneda y total coinciden con tolerancia de un centimo.

Una importacion no modifica inventario, cobros ni estados de la venta. Su objetivo es conservar y relacionar un comprobante emitido previamente por otro sistema sin reproducir efectos economicos.

## Estado tributario

El XML por si solo no demuestra la aceptacion de Hacienda. Los documentos importados quedan con `hacienda_status_verified = false`. Ese indicador solo puede cambiar cuando se incorpore una respuesta oficial o una consulta autenticada.

Los mensajes receptores se ofrecen unicamente para documentos entrantes que superaron el XSD. Preparar un mensaje lo archiva; el envio y la aceptacion de Hacienda siguen siendo estados distintos.

## Datos y seguridad

- `fiscal_xml_import_batches` conserva vistas previas, rechazos, duplicados e importaciones.
- `fiscal_received_documents` distingue `incoming` y `outgoing`, registra origen, huella, validacion XSD y venta vinculada.
- La funcion `import_fiscal_external_xml` vuelve a verificar empresa, permisos, tamaño, huella y vinculacion.
- RLS limita lotes y documentos a la empresa activa.
- Los bloqueos transaccionales por empresa, clave y huella evitan duplicados concurrentes.

La primera version procesa un XML por intento. Los lotes ZIP o cargas multiples deberan reutilizar este mismo contrato por fila, manteniendo la vista previa y el resultado individual.
