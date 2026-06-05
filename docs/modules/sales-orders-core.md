# Ventas / Ordenes Basicas

Ventas / Ordenes es el puente entre cotizaciones confirmadas y futuros modulos de
facturacion, inventario y despacho. En esta fase solo congela la informacion
comercial de una cotizacion confirmada.

## Incluye

- confirmar venta desde cotizacion con items
- listado de ventas
- detalle de venta
- items congelados
- totales congelados
- vinculo con cliente y cotizacion origen
- estados operativos basicos
- notas editables en ventas abiertas

## No Incluye Todavia

- facturacion
- factura electronica
- pagos
- cuentas por cobrar
- inventario
- descuento de stock
- despacho
- rutas
- entregas
- PDF
- Hacienda
- devoluciones
- notas de credito

## Tablas

La migracion `database/migrations/0012_ventas_core.sql` crea:

- `ventas`
- `venta_items`

Ambas tablas tienen `empresa_id`, RLS e indices por empresa. `ventas` conserva
el vinculo con `cotizaciones` y `crm_clientes`. `venta_items` copia los items de
cotizacion para congelar cantidades, precios, descuentos, impuestos y totales.

## RPCs

- `generar_venta_desde_cotizacion`
- `cambiar_estado_venta`
- `actualizar_notas_venta`

Las mutaciones se hacen por RPC. No se otorgan permisos directos de
insert/update/delete a usuarios normales.

## Permisos

- `sales.orders.view`
- `sales.orders.create`
- `sales.orders.edit`
- `sales.orders.status.change`

La migracion asigna estos permisos automaticamente solo a roles de sistema
`Administrador`. Otros roles deben recibirlos manualmente desde `/admin/roles`.

## Seguridad Multiempresa

Ninguna ruta, formulario ni RPC acepta `empresa_id`. La empresa se resuelve
server-side desde `auth.uid()` -> `profiles.id` -> `profiles.empresa_id`. Las
policies RLS filtran por `current_empresa_id()` y las RPCs validan permisos antes
de mutar.

## Precio E Items Congelados

La venta copia los items desde la cotizacion confirmada. Si la cotizacion, el
catalogo o los precios cambian despues, la venta no cambia automaticamente.
Esto conserva la orden comercial aprobada.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0012_ventas_core.sql
```

No ejecutar automaticamente desde la app y no usar `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba Manual

1. Crear una cotizacion con items.
2. Abrir `/cotizaciones`.
3. Usar `Confirmar venta`.
4. Confirmar que no se duplica la venta si se intenta de nuevo.
5. Usar `Ver venta`.
6. Abrir `/ventas`.
7. Abrir `/ventas/[ventaId]`.
8. Cambiar estado de venta.

## Proximos Pasos

- facturacion
- pagos
- cuentas por cobrar
- inventario
- despacho
