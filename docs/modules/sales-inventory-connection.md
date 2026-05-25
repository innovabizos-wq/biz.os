# Conexion Ventas e Inventario

Esta fase conecta ventas/ordenes con inventario mediante una salida asistida. No
descuenta stock al generar la venta; el usuario debe aplicar la salida desde el
detalle de venta.

## Incluye

- Estado de inventario en `ventas`.
- Resumen de items de venta que requieren inventario.
- Stock disponible por producto.
- Seleccion de bodega para salida.
- Salida manual vinculada a la venta.
- Bloqueo de doble aplicacion.
- Movimientos de inventario con `referencia_tipo = 'venta'` y
  `referencia_id = venta_id`.

## No incluye todavia

- Facturacion, Hacienda o factura electronica.
- Pagos o cuentas por cobrar.
- Compras o proveedores.
- Reservas de stock.
- Despacho, entregas o rutas.
- Devoluciones.
- Automatizacion al crear, aceptar o confirmar venta.

## SQL

Aplicar manualmente despues de `0013_inventario_core.sql`:

```text
database/migrations/0014_sales_inventory_connection.sql
```

La migracion agrega en `ventas`:

- `inventario_estado`
- `inventario_aplicado_at`
- `inventario_aplicado_por`

Estados:

- `pendiente`: venta aun no procesada contra inventario.
- `aplicado`: salida aplicada correctamente.
- `parcial`: reservado para una fase futura.
- `no_aplica`: venta sin productos fisicos inventariables.

## RPCs

- `obtener_resumen_inventario_venta`
- `aplicar_salida_inventario_venta`
- `marcar_venta_sin_inventario`

Las RPCs resuelven empresa con `current_empresa_id()`, no aceptan `empresa_id`,
validan permisos y ejecutan la salida de inventario de forma atomica. Si algun
producto no tiene stock suficiente, no se descuenta nada.

## Permisos

Para ver el panel:

- `sales.orders.view`
- `inventory.stock.view` o `inventory.stock.adjust`

Para aplicar la salida:

- `sales.orders.edit`
- `inventory.stock.adjust`

Para revisar movimientos:

- `inventory.movements.view`

## Flujo de prueba

1. Crear producto fisico activo en catalogo.
2. Crear bodega y registrar entrada de stock.
3. Crear cotizacion con ese producto.
4. Aceptar cotizacion y generar venta.
5. Cambiar venta a `confirmada`.
6. Abrir `/ventas/[ventaId]`.
7. Elegir bodega y aplicar salida de inventario.
8. Revisar que el stock bajo en `/inventario/productos`.
9. Revisar movimiento en `/inventario/movimientos`.
10. Intentar aplicar la salida otra vez y confirmar que se bloquea.

## Proximos pasos

- Reservas de stock.
- Despacho.
- Compras y reposicion.
- Facturacion.
- Devoluciones y notas de credito.
