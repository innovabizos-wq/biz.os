# Roadmap de facturacion real

## Listo ahora

- Billing como modulo opcional.
- Configuracion fiscal heredada con secretos cifrados.
- Migracion base para catálogos fiscales, CABYS, documentos internos,
  consecutivos, recepcion, entregas y health.
- Rutas iniciales de `/facturacion`.
- Preparacion fiscal interna desde ventas confirmadas.
- Reserva y asignacion de consecutivo/clave antes de XML.
- Generacion controlada de XML sin firmar como artefacto interno.
- Representacion grafica HTML archivada como artefacto fiscal interno.
- Registro de descarga o entrega manual sin correo automatico.
- Registro de XML recibido de proveedor con artefacto, hash y validacion minima.
- Diagnostico Platform Console con conteos de documentos, artefactos y recepcion.
- Reportes fiscales iniciales con documentos emitidos internos y XML recibidos.
- Recuperacion fiscal manual para consultar Hacienda en documentos ya
  enviados/procesando sin generar, firmar ni enviar XML automaticamente.
- Pantalla CABYS para asociar productos activos con codigos importados.
- Importador CABYS controlado con dry-run, hash SHA-256 y bitacora de lote.

## Preparado

- Interfaces para XML, firma y Hacienda.
- Documentos internos con lineas, impuestos, snapshots y eventos.
- Health fiscal para Platform Console sin secretos.

## Pendiente firma

- Implementar firma XAdES-EPES real con certificado `.p12` y PIN protegidos.
- Validar que el XML firmado incluye `ds:Signature`.

## Pendiente Hacienda

- OAuth/OIDC contra ambiente de pruebas.
- Envio de XML firmado.
- Consulta de estado.
- Persistencia de respuesta oficial y mensajes de rechazo.

## Pendiente producto comercial

- Renderer PDF binario completo.
- Correo con adjuntos fiscales XML/PDF.
- Recepcion completa con parseo de lineas/impuestos y mensaje receptor firmado.
- Automatizacion de descarga/verificacion CABYS contra fuente oficial versionada.
- Reportes fiscales con filtros y exportacion.
