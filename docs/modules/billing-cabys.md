# CABYS

CABYS es obligatorio para facturar bienes y servicios cuando aplique. La base
crea:

- `cabys_catalog`
- `cabys_import_batches`
- `catalog_product_fiscal_profile`
- `product_fiscal_special_fields`

No se poblan codigos falsos. El catalogo debe importarse desde una fuente
oficial y quedar registrado por lote con hash/version. Si un producto no tiene
perfil fiscal y CABYS, la preparacion de factura debe bloquearse.

Estado actual:

- `/facturacion/cabys` lista productos activos y su perfil fiscal.
- Permite buscar codigos existentes en `cabys_catalog` por codigo o descripcion.
- Permite validar en modo dry-run un CSV/TSV pegado con fuente, version/fecha,
  URL y hash SHA-256 del contenido.
- Permite importar lotes CABYS controlados, hasta 500 filas por lote, solo desde
  datos pegados por un usuario con `billing.cabys.manage`.
- Registra cada intento en `cabys_import_batches` con estado, conteos,
  version/hash y errores resumidos.
- `assignProductCabysAction` guarda `cabys_code`, unidad fiscal y notas por
  producto en `catalog_product_fiscal_profile`.
- La accion requiere `billing.cabys.manage`, valida empresa actual y rechaza
  codigos CABYS que no existan en el catalogo importado.

Pendiente:

- Automatizar descarga/verificacion contra una fuente oficial versionada.
- Validaciones completas por tipo de producto/servicio e impuestos.
