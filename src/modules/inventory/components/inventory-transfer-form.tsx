import { ArrowRightLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createInventoryTransferAction } from "@/modules/inventory/actions";
import type {
  InventoryProduct,
  InventoryWarehouse,
} from "@/modules/inventory/types";

type InventoryTransferFormProps = {
  canAdjust: boolean;
  products: InventoryProduct[];
  warehouses: InventoryWarehouse[];
};

export function InventoryTransferForm({
  canAdjust,
  products,
  warehouses,
}: InventoryTransferFormProps) {
  const activeWarehouses = warehouses.filter(
    (warehouse) => warehouse.estado === "activa",
  );

  if (!canAdjust) {
    return null;
  }

  return (
    <form
      action={createInventoryTransferAction}
      className="rounded-lg border bg-background p-5"
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
          <ArrowRightLeft aria-hidden="true" size={20} />
        </span>
        <div>
          <p className="font-semibold">Traslado entre bodegas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mueve stock de una bodega activa a otra. El sistema registra la
            salida y la entrada con la misma referencia de traslado.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Producto</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="productoId"
            required
          >
            <option value="">Seleccionar producto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.codigo ? `${product.codigo} - ` : ""}
                {product.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Origen</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="bodegaOrigenId"
            required
          >
            <option value="">Seleccionar</option>
            {activeWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Destino</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="bodegaDestinoId"
            required
          >
            <option value="">Seleccionar</option>
            {activeWarehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Cantidad</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            min="0.01"
            name="cantidad"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Motivo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="motivo"
            placeholder="Reabastecimiento, orden interna..."
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Requiere stock suficiente en origen y bodegas activas.
        </p>
        <Button disabled={activeWarehouses.length < 2} type="submit">
          Trasladar stock
        </Button>
      </div>
    </form>
  );
}
