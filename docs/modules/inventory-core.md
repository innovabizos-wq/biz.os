# Inventario basico manual

Inventario agrega control operativo simple de existencias por empresa. Usa los
productos fisicos del catalogo y no acepta `empresa_id` desde formularios ni
acciones; la empresa se resuelve en servidor desde la sesion y RLS.

## Incluye

- Bodegas por empresa.
- Stock actual por producto y bodega.
- Movimientos manuales de entrada, salida y ajuste.
- Minimos y maximos de stock.
- Historial de movimientos auditado.
- Vista de inventario en el detalle de producto del catalogo.

## No incluye todavia

- Compras, proveedores u ordenes de compra.
- Despacho, logistica, reservas o transferencias complejas.
- Descuento automatico por venta.
- Lotes, vencimientos, series o costo promedio.
- Facturacion, IA o importacion masiva.

## Tablas

`0013_inventario_core.sql` crea:

- `inventario_bodegas`: bodegas activas/inactivas por empresa.
- `inventario_stock`: existencia actual por producto y bodega.
- `inventario_movimientos`: historial de entradas, salidas y ajustes.

Los servicios del catalogo no manejan inventario. Las RPCs solo aceptan
productos con `tipo = 'producto'` y estado `activo`.

## RPCs

- `crear_inventario_bodega`
- `actualizar_inventario_bodega`
- `cambiar_estado_inventario_bodega`
- `registrar_movimiento_inventario`
- `actualizar_stock_minimos`

Todas resuelven `empresa_id` con `current_empresa_id()`, validan permisos,
validan pertenencia de producto/bodega a la empresa y registran auditoria. Las
mutaciones directas no se exponen a usuarios normales.

En ajustes, `p_cantidad` representa la cantidad final. El movimiento guarda la
diferencia absoluta entre stock anterior y nuevo; si no hay diferencia, se
rechaza como ajuste sin cambio.

## Permisos

- `inventory.stock.view`
- `inventory.stock.adjust`
- `inventory.movements.view`
- `inventory.warehouses.view`
- `inventory.warehouses.manage`

La migracion asigna estos permisos solo a roles de sistema `Administrador`. Los
roles operativos, como Bodega, deben recibirlos manualmente en `/admin/roles`.

## Aplicacion manual

Aplicar en Supabase SQL Editor, despues de `0012_ventas_core.sql`:

```text
database/migrations/0013_inventario_core.sql
```

No se debe ejecutar con `service_role` desde la app ni aceptar `empresa_id`
desde frontend.

## Pruebas

1. Ir a `/inventario/bodegas` y crear una bodega.
2. Crear o usar un producto fisico activo en `/catalogo/productos`.
3. Ir a `/inventario/productos` y registrar una entrada.
4. Registrar una salida menor o igual al stock actual.
5. Registrar un ajuste con una cantidad final distinta.
6. Ver el historial en `/inventario/movimientos`.
7. Abrir el producto en catalogo y revisar su seccion de inventario.

## Proximos pasos

- Conectar ventas a descuento de stock con confirmacion explicita.
- Reservas de stock.
- Despacho.
- Compras y proveedores.
- Costos.
- Lotes y vencimientos.
