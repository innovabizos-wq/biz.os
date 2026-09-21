# API publica Biz.OS v1

La API publica permite consultar datos de una empresa sin usar la sesion web de un usuario. El contrato OpenAPI se sirve en `/api/v1/openapi.json`.

## Autenticacion

Un administrador crea la clave en **Configuracion → Conexiones → API publica v1**. La credencial completa se muestra una sola vez. Biz.OS conserva un hash SHA-256 y un prefijo para localizarla; no almacena el secreto recuperable.

La solicitud puede enviar la credencial de cualquiera de estas formas:

```http
Authorization: Bearer bizos_live_<prefijo>_<secreto>
```

```http
X-API-Key: bizos_live_<prefijo>_<secreto>
```

Cada clave tiene fecha de vencimiento, estado, permisos y un limite entre 1 y 600 solicitudes por minuto. Una empresa suspendida o una clave revocada deja de autorizar solicitudes inmediatamente.

## Recursos de lectura

| Ruta | Permiso |
|---|---|
| `GET /api/v1/clients` | `clients:read` |
| `GET /api/v1/catalog` | `catalog:read` |
| `GET /api/v1/sales` | `sales:read` |
| `GET /api/v1/payments` | `payments:read` |
| `GET /api/v1/fiscal-documents` | `fiscal_documents:read` |

Todas las consultas aplican `empresa_id` desde la clave validada en el servidor. El cliente no puede elegir la empresa mediante un parametro.

## Paginacion

`limit` acepta de 1 a 100 registros y su valor predeterminado es 50. Cuando `meta.hasMore` es verdadero, se envia `meta.nextCursor` en la siguiente solicitud:

```http
GET /api/v1/sales?limit=50&cursor=<nextCursor>
```

El cursor combina fecha e identificador para mantener un orden estable. Un cursor alterado o mal formado devuelve `INVALID_CURSOR`.

## Respuestas y errores

Una respuesta correcta contiene `data`, `meta` y `requestId`. Los errores conservan el mismo formato:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "La clave no tiene el permiso requerido.",
    "requestId": "0f70cfcb-2387-4d37-96fd-34977c1e364c"
  }
}
```

Los codigos iniciales son `AUTHENTICATION_REQUIRED`, `FORBIDDEN`, `RATE_LIMITED`, `INVALID_CURSOR`, `RESOURCE_QUERY_FAILED` e `INTERNAL_ERROR`. El encabezado `X-Request-Id` permite correlacionar cada respuesta con el registro operativo.

## Escrituras

Esta entrega expone recursos de lectura. La base incorpora `public_api_idempotency` para que los futuros `POST` guarden clave, hash exacto de solicitud y respuesta original. Una clave repetida con contenido diferente debera devolver conflicto antes de habilitar ventas, pagos o documentos por API.
