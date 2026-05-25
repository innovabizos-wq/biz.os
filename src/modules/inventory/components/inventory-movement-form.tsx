import { createInventoryMovementAction } from "@/modules/inventory/actions";
import type {
  InventoryProduct,
  InventoryWarehouse,
} from "@/modules/inventory/types";
import { Button } from "@/components/ui/button";

type InventoryMovementFormProps = {
  canAdjust: boolean;
  products: InventoryProduct[];
  warehouses: InventoryWarehouse[];
};

export function InventoryMovementForm({
  canAdjust,
  products,
  warehouses,
}: InventoryMovementFormProps) {
  if (!canAdjust) {
    return null;
  }

  return (
    <form action={createInventoryMovementAction} className="space-y-4 rounded-lg border bg-background p-5">
      <div>
        <p className="font-medium">Registrar movimiento manual</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Entrada, salida o ajuste final. Solo productos fisicos activos.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
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
          <span className="font-medium">Bodega</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="bodegaId"
            required
          >
            <option value="">Seleccionar</option>
            {warehouses
              .filter((warehouse) => warehouse.estado === "activa")
              .map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.nombre}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="tipo"
          >
            <option value="entrada">Entrada</option>
            <option value="salida">Salida</option>
            <option value="ajuste">Ajuste</option>
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
      </div>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Motivo</span>
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          name="motivo"
          placeholder="Compra manual, ajuste fisico, salida operativa..."
        />
      </label>
      <Button type="submit">Registrar movimiento</Button>
    </form>
  );
}
