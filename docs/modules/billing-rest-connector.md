# Contrato fiscal REST configurable

Biz.OS puede emitir y recuperar documentos mediante un servicio HTTPS que
implemente el contrato `bizos-fiscal-v1`. El perfil es declarativo: guarda URL,
rutas y nombres de campos. No acepta JavaScript, plantillas ejecutables ni
código suministrado por la empresa.

## Activación

El operador debe incluir el hostname exacto en `BILLING_REST_ALLOWED_HOSTS`.
Luego la empresa completa **Administración → Conexiones → REST configurable**
con sus credenciales y estas rutas:

- `GET /fiscal-contract` para verificar el contrato;
- `POST /fiscal-documents` para emitir;
- `GET /fiscal-documents/{reference}` para recuperar el estado.

Las rutas son configurables. La de estado debe contener `{reference}` una sola
vez. La verificación solo activa la conexión cuando recibe JSON con:

```json
{
  "contractVersion": "bizos-fiscal-v1",
  "capabilities": ["issue", "status", "idempotency"]
}
```

## Emisión

Biz.OS envía un documento fiscal canónico con emisor, receptor, líneas,
impuestos, pagos, referencias, moneda, totales y ambiente. La solicitud lleva
la misma referencia estable en el cuerpo y en el header `Idempotency-Key`:

```text
bizos-fiscal-{documentId}
```

El proveedor debe guardar el primer resultado para esa clave. Repetirla con el
mismo contenido devuelve la operación original y no crea otro comprobante. El
JSON de respuesta debe repetir la referencia exacta; Biz.OS rechaza una
referencia distinta.

Por defecto se leen `status`, `documentId` y `reference`. Se pueden declarar
rutas anidadas como `data.status`. También se configuran listas separadas para
estados aceptados, en proceso y rechazados. Un valor no reconocido conserva el
documento en revisión y provoca una consulta posterior.

## Recuperación y seguridad

Una respuesta perdida se recupera con la referencia estable. Los reintentos de
la cola mantienen la misma clave y el documento continúa vinculado con la
conexión original, aunque después se active otro proveedor.

Las solicitudes bloquean HTTP, credenciales dentro de la URL, redes privadas,
hosts locales y redirecciones. Las respuestas JSON tienen límite de 1 MB, las
esperas tienen vencimiento y los secretos permanecen cifrados. Cada respuesta
se archiva con hash SHA-256 como `provider_response`.

La activación comercial requiere probar en el ambiente de pruebas una emisión,
una repetición con la misma clave, una consulta, un rechazo y una respuesta
perdida. El handshake confirma el contrato técnico, pero esa evidencia externa
es la que demuestra que el proveedor lo cumple.
