import { randomUUID } from "node:crypto";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reconcileInventoryCostAction } from "@/modules/inventory/actions";
import type { InventoryStock } from "@/modules/inventory/types";

type StockCostReconciliationFormProps = {
  canAdjust: boolean;
  stock: InventoryStock;
};

export function StockCostReconciliationForm({
  canAdjust,
  stock,
}: StockCostReconciliationFormProps) {
  if (!canAdjust) return null;

  return (
    <details className="min-w-52">
      <summary className="cursor-pointer text-xs font-medium underline underline-offset-2">
        Conciliar costo
      </summary>
      <form action={reconcileInventoryCostAction} className="mt-3 grid gap-2">
        <input name="bodegaId" type="hidden" value={stock.bodegaId} />
        <input name="operationId" type="hidden" value={randomUUID()} />
        <input name="productoId" type="hidden" value={stock.productoId} />
        <Input
          defaultValue={stock.averageUnitCost ?? undefined}
          min="0"
          name="unitCost"
          placeholder="Costo unitario"
          required
          step="0.000001"
          type="number"
        />
        <Input
          maxLength={500}
          minLength={3}
          name="reason"
          placeholder="Fuente o motivo"
          required
        />
        <Button size="sm" type="submit" variant="outline">
          Guardar costo
        </Button>
      </form>
    </details>
  );
}
