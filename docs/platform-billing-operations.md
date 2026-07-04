# Platform Billing Operations

Platform Console puede diagnosticar billing por empresa sin ver secretos.

Permitido:

- Modulo billing activo/inactivo.
- Estado de configuracion fiscal.
- Certificado presente si/no.
- Ultimo estado Hacienda.
- Ultimo error.
- Conteo de documentos por estado.
- Conteo de artefactos fiscales por tipo.
- Conteo de XML recibidos por estado receptor.
- Conteo de artefactos recibidos por tipo.
- Cantidad de errores del ultimo XML recibido con problemas.

Prohibido:

- PIN.
- Certificado.
- Contrasena Hacienda.
- Token.
- Referencias completas de secretos.

La funcion `get_platform_billing_health(empresa_id)` devuelve un resumen seguro
para operadores platform.

El detalle `/platform/empresas/[empresaId]` consume ese resumen para diagnostico
operativo. La vista muestra agregados y estados, no contenidos de XML/PDF ni
rutas de secretos.
