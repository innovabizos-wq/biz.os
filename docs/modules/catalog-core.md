# Catalogo Basico

Catalogo basico permite que cada empresa mantenga su propio catalogo comercial
de productos y servicios. No administra inventario ni stock; solo guarda datos
comerciales que mas adelante podran conectarse con cotizaciones.

## Incluye

- categorias simples
- productos
- servicios
- codigo opcional
- unidad de medida
- precio base
- impuesto sugerido
- moneda
- activar e inactivar categorias
- activar e inactivar productos y servicios

## No Incluye Todavia

- inventario
- stock
- bodegas
- movimientos
- compras
- costos avanzados
- variantes
- codigos de barras
- imagenes
- importacion masiva
- seleccion automatica en cotizaciones
- facturacion
- Hacienda
- IA

## Tablas

La migracion `database/migrations/0010_catalogo_productos.sql` crea:

- `catalogo_categorias`
- `catalogo_productos`

Ambas tablas tienen `empresa_id`, RLS, auditoria por RPC, indices por empresa y
triggers `updated_at`. `catalogo_productos.categoria_id` se valida contra una
categoria de la misma empresa mediante foreign key compuesta.

## RPCs

- `crear_catalogo_categoria`
- `actualizar_catalogo_categoria`
- `cambiar_estado_catalogo_categoria`
- `crear_catalogo_producto`
- `actualizar_catalogo_producto`
- `cambiar_estado_catalogo_producto`

Las mutaciones se hacen por RPC. No se otorgan permisos directos de
insert/update/delete a usuarios normales.

## Permisos

- `catalog.products.view`
- `catalog.products.create`
- `catalog.products.edit`
- `catalog.categories.view`
- `catalog.categories.create`
- `catalog.categories.edit`

La migracion asigna estos permisos automaticamente solo a roles de sistema
`Administrador`. Otros roles deben recibirlos manualmente desde `/admin/roles`.

## Seguridad Multiempresa

Ningun formulario ni RPC acepta `empresa_id`. La empresa se resuelve server-side
desde `auth.uid()` -> `profiles.id` -> `profiles.empresa_id`. Las policies RLS
filtran por `current_empresa_id()` y las RPCs validan permisos antes de mutar.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0010_catalogo_productos.sql
```

No ejecutar automaticamente desde la app y no usar `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba Manual

1. Entrar como administrador.
2. Abrir `/catalogo`.
3. Abrir `/catalogo/categorias`.
4. Crear una categoria.
5. Abrir `/catalogo/productos/nuevo`.
6. Crear un producto.
7. Crear un servicio.
8. Abrir el detalle de un producto.
9. Editar precio, impuesto sugerido o unidad.
10. Inactivar y reactivar producto o categoria.

## Proximos Pasos

- conectar catalogo a items de cotizaciones
- inventario
- costos
- imagenes
- importacion masiva
