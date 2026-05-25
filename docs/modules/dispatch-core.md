# Despacho basico

Despacho agrega seguimiento operativo simple para entregas, instalaciones,
visitas o trabajos derivados de una venta. Es una capa de cumplimiento, no un
motor logistico avanzado.

## Incluye

- Crear un despacho desde una venta.
- Un despacho por venta en esta fase.
- Lista y detalle de despachos.
- Estado operativo.
- Responsable.
- Fecha y hora programada.
- Direccion o ubicacion textual.
- Contacto, telefono, notas y resultado.
- Vinculo con venta y cliente.

## No incluye todavia

- Rutas avanzadas.
- Mapas, geocoding, Google Maps o Waze.
- Tracking.
- Pruebas de entrega con firma o foto.
- Vehiculos, capacidad o control de camiones.
- Multiples entregas por venta.
- Despacho parcial.
- Costos de envio.

## Relacion venta -> despacho

El despacho se crea desde `/ventas/[ventaId]` cuando la venta esta en estado
`confirmada`, `en_proceso` o `completada`. La tabla `despachos` guarda
`venta_id` y `cliente_id`, manteniendo trazabilidad sin aceptar `empresa_id`
desde el frontend.

## Estados

- `pendiente`
- `preparando`
- `listo`
- `en_ruta`
- `entregado`
- `fallido`
- `cancelado`

Las transiciones son simples:

- `pendiente` -> `preparando`
- `preparando` -> `listo`
- `listo` -> `en_ruta`
- `en_ruta` -> `entregado`
- estados abiertos -> `fallido` o `cancelado`

Los estados `entregado` y `cancelado` bloquean cambios posteriores.

## Permisos

- `dispatch.orders.view`
- `dispatch.orders.create`
- `dispatch.orders.edit`
- `dispatch.orders.status.change`

La migracion asigna estos permisos solo a roles de sistema `Administrador`. Los
roles operativos deben recibir permisos manualmente desde `/admin/roles`.

## SQL

Aplicar manualmente despues de `0014_sales_inventory_connection.sql`:

```text
database/migrations/0015_despacho_core.sql
```

La migracion crea `despachos`, RLS, permisos y RPCs. Las mutaciones se hacen por
RPCs seguras, con empresa resuelta por `current_empresa_id()`.

## RPCs

- `crear_despacho_desde_venta`
- `actualizar_despacho`
- `cambiar_estado_despacho`

Las RPCs validan permisos, pertenencia de venta/cliente/responsable a la empresa,
no reciben `empresa_id` y registran auditoria.

## Prueba manual

1. Tener una venta en estado `confirmada`, `en_proceso` o `completada`.
2. Abrir `/ventas/[ventaId]`.
3. Crear despacho con fecha, responsable y datos de entrega.
4. Abrir `/despacho`.
5. Abrir `/despacho/[despachoId]`.
6. Cambiar estados hasta `entregado`, `fallido` o `cancelado`.

## Proximos pasos

- Rutas.
- Responsables y vehiculos formales.
- Pruebas de entrega.
- Mapas.
- Optimizacion.
