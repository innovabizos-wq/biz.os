import type { Sale } from "@/modules/sales/types";
import { markSaleWithoutInventoryAction } from "@/modules/sales-inventory/actions";
import { ApplySaleInventoryForm } from "@/modules/sales-inventory/components/apply-sale-inventory-form";
import { SaleInventoryItemsTable } from "@/modules/sales-inventory/components/sale-inventory-items-table";
import type {
  SaleInventorySummaryItem,
  SaleInventoryWarehouse,
} from "@/modules/sales-inventory/types";
import { Button } from "@/components/ui/button";

type SaleInventoryPanelProps = {
  canApply: boolean;
  canMarkWithoutInventory: boolean;
  items: SaleInventorySummaryItem[];
  sale: Sale;
  warehouses: SaleInventoryWarehouse[];
};

export function SaleInventoryPanel({
  canApply,
  canMarkWithoutInventory,
  items,
  sale,
  warehouses,
}: SaleInventoryPanelProps) {
  const inventoryItems = items.filter((item) => item.requiereInventario);
  const hasInventoryItems = inventoryItems.length > 0;
  const hasInsufficientStock = inventoryItems.some((item) => !item.stockSuficiente);
  const canApplyForStatus =
    sale.estado === "confirmada" || sale.estado === "en_proceso";
  const alreadyApplied =
    sale.inventarioEstado === "aplicado" ||
    inventoryItems.some((item) => item.yaAplicado);
  const showApply =
    canApply &&
    canApplyForStatus &&
    hasInventoryItems &&
    !alreadyApplied &&
    !hasInsufficientStock;
  const showMarkWithoutInventory =
    canMarkWithoutInventory && !hasInventoryItems && sale.inventarioEstado !== "no_aplica";

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Inventario de la venta</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado: {sale.inventarioEstado}
            </p>
            {sale.inventarioAplicadoAt ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Aplicado:{" "}
                {new Date(sale.inventarioAplicadoAt).toLocaleString("es-CR")}
              </p>
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">
            {alreadyApplied
              ? "La salida ya fue aplicada."
              : hasInventoryItems
                ? "La salida se aplica manualmente desde una bodega."
                : "Esta venta no tiene productos inventariables."}
          </div>
        </div>
      </div>

      {items.length > 0 ? (
        <SaleInventoryItemsTable items={items} />
      ) : (
        <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
          No hay items para evaluar inventario.
        </div>
      )}

      {hasInsufficientStock && !alreadyApplied ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Hay stock insuficiente. Registra entrada o ajusta stock antes de aplicar
          la salida.
        </p>
      ) : null}

      {!canApplyForStatus && hasInventoryItems && !alreadyApplied ? (
        <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
          Para aplicar inventario, la venta debe estar confirmada o en proceso.
        </p>
      ) : null}

      <ApplySaleInventoryForm
        canApply={showApply}
        saleId={sale.id}
        warehouses={warehouses}
      />

      {showMarkWithoutInventory ? (
        <form action={markSaleWithoutInventoryAction}>
          <input name="ventaId" type="hidden" value={sale.id} />
          <Button type="submit" variant="outline">
            Marcar sin inventario
          </Button>
        </form>
      ) : null}
    </section>
  );
}
