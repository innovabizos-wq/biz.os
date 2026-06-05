# Cotizaciones Basicas

Cotizaciones basicas agrega una capa comercial previa a ventas. Trabaja
conectada al CRM para crear cotizaciones desde clientes o prospectos, sin
convertirlas todavia en ventas, facturas ni movimientos de inventario.

## Incluye

- listado de cotizaciones
- creacion manual seleccionando cliente CRM
- creacion desde el detalle del cliente CRM
- detalle de cotizacion
- items manuales
- calculo de subtotal, descuento, impuesto y total
- confirmacion de venta desde cotizacion con items

## No Incluye Todavia

- PDF
- envio por correo
- aceptacion por cliente
- venta desde boton Confirmar venta
- facturacion
- inventario
- productos reales
- impuestos avanzados
- multi-moneda avanzada
- Hacienda
- WhatsApp real
- IA

## Tablas

La migracion `database/migrations/0009_cotizaciones_core.sql` crea:

- `cotizaciones`
- `cotizacion_items`

Ambas tablas tienen `empresa_id`, RLS e indices por empresa. Las relaciones con
`crm_clientes` y `profiles` usan constraints compuestas para mantener la
pertenencia a la misma empresa.

## RPCs

- `crear_cotizacion`
- `actualizar_cotizacion`
- `agregar_item_cotizacion`
- `actualizar_item_cotizacion`
- `eliminar_item_cotizacion`
- `cambiar_estado_cotizacion`
- `recalcular_totales_cotizacion`

`recalcular_totales_cotizacion` es una funcion interna sin grant a usuarios
autenticados. Las mutaciones publicas se hacen por RPC y no por writes directos.

## Permisos

- `quotes.view`: listar y ver cotizaciones.
- `quotes.create`: crear cotizaciones.
- `quotes.edit`: editar datos e items.
- `quotes.status.change`: cambiar estado comercial.

La migracion asigna estos permisos automaticamente solo a roles de sistema
`Administrador`. Otros roles deben recibirlos manualmente desde `/admin/roles`.

## Seguridad Multiempresa

Ninguna ruta, formulario ni RPC acepta `empresa_id`. La empresa se resuelve
server-side desde `auth.uid()` -> `profiles.id` -> `profiles.empresa_id`.
Supabase RLS filtra por `current_empresa_id()` y cada RPC valida permisos antes
de mutar datos.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0009_cotizaciones_core.sql
```

No ejecutar automaticamente desde la app y no usar `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba Manual

1. Entrar como administrador.
2. Abrir un cliente en `/crm/clientes/[clienteId]`.
3. Usar `Crear cotizacion`.
4. Completar datos base y crear.
5. Agregar items manuales en el detalle.
6. Confirmar que subtotal, descuento, impuesto y total se recalculan.
7. Confirmar que no se puede crear una cotizacion sin items.
8. Abrir `/cotizaciones` y usar `Confirmar venta`.
9. Confirmar que la cotizacion convertida muestra `Ver venta`.

En el MVP no se guardan cotizaciones vacias. La proforma puede prepararse en el
popup, pero el registro real se crea solo al presionar `Crear cotizacion` con al
menos un item valido.

## Proximos Pasos

- PDF
- envio por correo
- estados avanzados de aprobacion del cliente
- facturacion
- inventario y productos
