# Conversation Actions

La capa de acciones conversacionales convierte una intencion ya interpretada por IA en una operacion segura del sistema. La IA no ejecuta directamente: el backend resuelve una accion registrada, valida permisos, valida parametros, exige confirmacion cuando aplica y escribe auditoria.

## Endpoints

- `GET /api/ai/conversation/actions`: lista acciones disponibles para el usuario actual segun permisos.
- `POST /api/ai/conversation/dry-run`: valida una accion sin ejecutarla. Puede recibir `actionId` + `params`, o `module` + `userMessage` para interpretar con IA.
- `POST /api/ai/conversation/execute`: ejecuta solo acciones que no requieren confirmacion. Para acciones sensibles devuelve `confirmationRequired: true` y un token temporal.
- `POST /api/ai/conversation/confirm`: ejecuta una accion sensible usando `confirmationToken`.

## Acciones iniciales

- `clientes.buscar_cliente`: lectura CRM.
- `clientes.crear_cliente`: crea cliente/prospecto, requiere confirmacion y valida duplicados basicos.
- `productos.buscar_producto`: lectura catalogo.
- `productos.crear_producto`: crea producto/servicio, requiere confirmacion.
- `inventario.consultar_stock`: lectura inventario.
- `proformas.crear_borrador`: crea cotizacion/proforma, requiere confirmacion.

## Seguridad

- Las acciones se definen en `src/lib/ai/action-registry/registry.ts`.
- Cada accion declara modulo, permisos, riesgo, schema Zod y si requiere confirmacion.
- Los tokens de confirmacion duran 5 minutos y se firman con `AI_ACTION_CONFIRMATION_SECRET`. Si no existe, se usa `AI_SETTINGS_ENCRYPTION_KEY` o `FISCAL_CONFIG_ENCRYPTION_KEY`.
- En desarrollo local hay fallback estable para no bloquear pruebas.
- La auditoria se guarda en `auditoria_eventos` con entidad `conversation_action`.

## Ejemplo

Dry-run:

```json
{
  "actionId": "clientes.buscar_cliente",
  "params": {
    "query": "Antonio",
    "limit": 5
  }
}
```

Ejecucion con confirmacion:

```json
{
  "actionId": "clientes.crear_cliente",
  "params": {
    "nombre": "Cliente Demo",
    "tipo": "prospecto",
    "genero": "o"
  }
}
```

El backend devuelve `confirmationToken`; luego se envia:

```json
{
  "confirmationToken": "..."
}
```
