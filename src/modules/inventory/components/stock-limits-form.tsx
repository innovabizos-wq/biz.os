import { updateStockLimitsAction } from "@/modules/inventory/actions";
import type { InventoryStock } from "@/modules/inventory/types";
import { Button } from "@/components/ui/button";

type StockLimitsFormProps = {
  canAdjust: boolean;
  stock: InventoryStock;
};

export function StockLimitsForm({ canAdjust, stock }: StockLimitsFormProps) {
  if (!canAdjust) {
    return null;
  }

  return (
    <form action={updateStockLimitsAction} className="flex flex-wrap gap-2">
      <input name="productoId" type="hidden" value={stock.productoId} />
      <input name="bodegaId" type="hidden" value={stock.bodegaId} />
      <input
        aria-label="Stock minimo"
        className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
        defaultValue={stock.stockMinimo}
        min="0"
        name="stockMinimo"
        step="0.01"
        type="number"
      />
      <input
        aria-label="Stock maximo"
        className="h-8 w-20 rounded-md border bg-background px-2 text-sm"
        defaultValue={stock.stockMaximo ?? ""}
        min="0"
        name="stockMaximo"
        placeholder="Max"
        step="0.01"
        type="number"
      />
      <Button size="sm" type="submit" variant="outline">
        Guardar
      </Button>
    </form>
  );
}
