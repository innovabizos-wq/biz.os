import { applySaleInventoryAction } from "@/modules/sales-inventory/actions";
import type { SaleInventoryWarehouse } from "@/modules/sales-inventory/types";
import { Button } from "@/components/ui/button";

type ApplySaleInventoryFormProps = {
  canApply: boolean;
  saleId: string;
  warehouses: SaleInventoryWarehouse[];
};

export function ApplySaleInventoryForm({
  canApply,
  saleId,
  warehouses,
}: ApplySaleInventoryFormProps) {
  if (!canApply) {
    return null;
  }

  return (
    <form action={applySaleInventoryAction} className="flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4">
      <input name="ventaId" type="hidden" value={saleId} />
      <label className="space-y-1 text-sm">
        <span className="font-medium">Bodega de salida</span>
        <select
          className="h-9 min-w-56 rounded-md border bg-background px-3 text-sm"
          name="bodegaId"
          required
        >
          <option value="">Seleccionar bodega</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.nombre}
            </option>
          ))}
        </select>
      </label>
      <Button disabled={warehouses.length === 0} type="submit">
        Aplicar salida de inventario
      </Button>
    </form>
  );
}
