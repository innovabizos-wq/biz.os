# Roadmap de facturacion real

## Listo ahora

- Billing como modulo opcional.
- Configuracion fiscal heredada con secretos cifrados.
- Migracion base para catálogos fiscales, CABYS, documentos internos,
  consecutivos, recepcion, entregas y health.
- Rutas iniciales de `/facturacion`.
- Preparacion fiscal interna desde ventas confirmadas.
- Reserva y asignacion de consecutivo/clave antes de XML.
- Generación de XML 4.4 para factura, tiquete y estructuras de notas.
- Validación obligatoria con XSD 4.4 versionados y libxml2.
- Firma XAdES-EPES real con certificado PKCS#12 y verificación criptográfica.
- Cliente directo de Hacienda con autenticación, envío, consulta y recuperación
  por clave.
- Archivo privado del XML firmado y de la respuesta oficial final.
- Representacion grafica HTML archivada como artefacto fiscal interno.
- Registro de descarga o entrega manual sin correo automatico.
- Registro de XML recibido de proveedor con artefacto, hash y validacion minima.
- Diagnostico Platform Console con conteos de documentos, artefactos y recepcion.
- Reportes fiscales iniciales con documentos emitidos internos y XML recibidos.
- Recuperacion fiscal manual para consultar Hacienda en documentos ya
  enviados/procesando sin generar, firmar ni enviar XML automaticamente.
- Pantalla CABYS para asociar productos activos con codigos importados.
- Importador CABYS controlado con dry-run, hash SHA-256 y bitacora de lote.

## Preparado y protegido

- Documentos internos con lineas, impuestos, snapshots y eventos.
- Health fiscal para Platform Console sin secretos.
- Interruptores server-side independientes para envío y consulta.
- Pruebas automatizadas de builder, PKCS#12, firma, verificación y XSD.

## Pendiente producto comercial

- Renderer PDF binario completo.
- Correo con adjuntos fiscales XML/PDF.
- Recepcion completa con parseo de lineas/impuestos y mensaje receptor firmado.
- Automatizacion de descarga/verificacion CABYS contra fuente oficial versionada.
- Reportes fiscales con filtros y exportacion.
- Pruebas de aceptación con credenciales y certificado reales en Hacienda para
  factura, tiquete, notas, rechazos y recuperación de respuestas inciertas.
- Cerrar los efectos comerciales, financieros y físicos de notas de crédito y
  débito antes de habilitarlas para venta.
