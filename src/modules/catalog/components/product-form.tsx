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
import { Button } from "@/components/ui/button";

type ProductFormProps = {
  categories: CatalogCategory[];
  mode: "create" | "update";
  product?: CatalogProduct;
};

export function ProductForm({ categories, mode, product }: ProductFormProps) {
  const action = mode === "create" ? createProductAction : updateProductAction;

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
      <Button type="submit">
        {mode === "create" ? "Crear producto/servicio" : "Guardar cambios"}
      </Button>
    </form>
  );
}
