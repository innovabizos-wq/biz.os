# Conexion Cotizaciones Y Catalogo

Esta fase conecta el catalogo comercial con los items de cotizacion. Los items
siguen pudiendo ser manuales, pero ahora pueden vincularse opcionalmente a un
producto o servicio activo del catalogo.

## Como Funciona

`cotizacion_items` agrega `producto_id` nullable. Cuando se selecciona un
producto o servicio en una cotizacion, la UI autollena descripcion, precio base e
impuesto sugerido. El usuario puede ajustar cantidad, descuento, descripcion,
precio e impuesto antes de guardar.

## Precio Historico

El item guarda `descripcion`, `precio_unitario`, `descuento`,
`impuesto_porcentaje`, `subtotal`, `impuesto_monto` y `total` en la cotizacion.
Si el producto cambia de precio despues, la cotizacion no se recalcula
automaticamente. Esto conserva el precio historico negociado.

## No Incluye Todavia

- inventario
- stock
- reservas
- ventas
- facturacion
- Hacienda
- PDF
- envio por correo

## SQL

La migracion `database/migrations/0011_quotes_catalog_connection.sql`:

- agrega `cotizacion_items.producto_id`
- agrega foreign key compuesta hacia `catalogo_productos(id, empresa_id)`
- agrega indices por producto
- actualiza `agregar_item_cotizacion`
- actualiza `actualizar_item_cotizacion`

## RPCs Actualizadas

- `agregar_item_cotizacion(..., p_producto_id uuid default null)`
- `actualizar_item_cotizacion(..., p_producto_id uuid default null)`

Ambas validan `quotes.edit`, resuelven empresa con `current_empresa_id()` y, si
`p_producto_id` viene informado, validan que el producto pertenezca a la empresa
actual y este activo.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0011_quotes_catalog_connection.sql
```

No ejecutar automaticamente desde la app y no usar `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba Manual

1. Crear una categoria en `/catalogo/categorias`.
2. Crear un producto o servicio activo en `/catalogo/productos/nuevo`.
3. Crear una cotizacion en `/cotizaciones/nueva`.
4. Abrir `/cotizaciones/[cotizacionId]`.
5. En items, seleccionar el producto o servicio del catalogo.
6. Confirmar que descripcion, precio e impuesto se autollenan.
7. Ajustar precio o descuento manualmente.
8. Guardar y confirmar totales.
9. Agregar un item manual sin producto y confirmar que sigue funcionando.

## Proximos Pasos

- productos recurrentes
- combos
- inventario
- ventas
- facturacion
