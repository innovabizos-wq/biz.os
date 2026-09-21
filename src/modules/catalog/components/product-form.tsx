import {
  createProductAction,
  updateProductAction,
} from "@/modules/catalog/actions";
import {
  CATALOG_MONEDAS,
  CATALOG_PRODUCT_TYPES,
  DEFAULT_CATALOG_MONEDA,
  DEFAULT_UNIDAD_MEDIDA,
} from "@/modules/catalog/constants";
import type { CatalogCategory, CatalogProduct } from "@/modules/catalog/types";
import type { InventoryWarehouse } from "@/modules/inventory/types";
import { Button } from "@/components/ui/button";

type ProductFormProps = {
  categories: CatalogCategory[];
  canSetInitialStock?: boolean;
  mode: "create" | "update";
  product?: CatalogProduct;
  warehouses?: InventoryWarehouse[];
};

export function ProductForm({
  canSetInitialStock = false,
  categories,
  mode,
  product,
  warehouses = [],
}: ProductFormProps) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.estado === "activa",
  );
  const showInitialStock = mode === "create" && canSetInitialStock;

  return (
    <form action={action} className="space-y-4 rounded-lg border bg-background p-5">
      {product ? <input name="productoId" type="hidden" value={product.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.tipo ?? "producto"}
            name="tipo"
          >
            {CATALOG_PRODUCT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Codigo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.codigo ?? ""}
            name="codigo"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Categoria</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.categoriaId ?? ""}
            name="categoriaId"
          >
            <option value="">Sin categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.nombre ?? ""}
            name="nombre"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Unidad de medida</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.unidadMedida ?? DEFAULT_UNIDAD_MEDIDA}
            name="unidadMedida"
            required
          />
        </label>
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Descripcion</span>
        <textarea
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={product?.descripcion ?? ""}
          name="descripcion"
        />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Precio base</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.precioBase ?? 0}
            min="0"
            name="precioBase"
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Impuesto %</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.impuestoPorcentaje ?? 0}
            max="100"
            min="0"
            name="impuestoPorcentaje"
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Moneda</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={product?.moneda ?? DEFAULT_CATALOG_MONEDA}
            name="moneda"
          >
            {CATALOG_MONEDAS.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
      {showInitialStock ? (
        <div className="space-y-3 rounded-md border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-semibold">Inventario inicial</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opcional para productos fisicos. Los servicios no usan inventario.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Bodega</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue={activeWarehouses[0]?.id ?? ""}
                name="bodegaId"
              >
                <option value="">Sin stock inicial</option>
                {activeWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Cantidad inicial</span>
              <input
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                min="0"
                name="cantidadInicial"
                placeholder="0"
                step="0.01"
                type="number"
              />
            </label>
          </div>
        </div>
      ) : null}
      <Button type="submit">
        {mode === "create" ? "Crear producto/servicio" : "Guardar cambios"}
      </Button>
    </form>
  );
}
