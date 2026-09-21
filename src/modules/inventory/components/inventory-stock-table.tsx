import type { InventoryStock } from "@/modules/inventory/types";
import { StockLimitsForm } from "@/modules/inventory/components/stock-limits-form";
import { StockCostReconciliationForm } from "@/modules/inventory/components/stock-cost-reconciliation-form";

type InventoryStockTableProps = {
  canAdjust: boolean;
  stock: InventoryStock[];
};

const CRC_FORMATTER = new Intl.NumberFormat("es-CR", {
  currency: "CRC",
  style: "currency",
});

function getStockStatus(item: InventoryStock) {
  if (item.stockMinimo > 0 && item.cantidad < item.stockMinimo) {
    return "bajo";
  }

  if (item.stockMaximo !== null && item.cantidad > item.stockMaximo) {
    return "sobre maximo";
  }

  return "ok";
}

export function InventoryStockTable({ canAdjust, stock }: InventoryStockTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3">Codigo</th>
            <th className="px-4 py-3">Bodega</th>
            <th className="px-4 py-3">Cantidad</th>
            <th className="px-4 py-3">Minimo</th>
            <th className="px-4 py-3">Maximo</th>
            <th className="px-4 py-3">Estado stock</th>
            <th className="px-4 py-3">Costo promedio</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Estado costo</th>
            <th className="px-4 py-3">Conciliacion</th>
            <th className="px-4 py-3">Limites</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((item) => (
            <tr className="border-t align-top" key={item.id}>
              <td className="px-4 py-3 font-medium">
                {item.productoNombre ?? "Producto"}
              </td>
              <td className="px-4 py-3">{item.productoCodigo ?? "-"}</td>
              <td className="px-4 py-3">{item.bodegaNombre ?? "Bodega"}</td>
              <td className="px-4 py-3">{item.cantidad}</td>
              <td className="px-4 py-3">{item.stockMinimo}</td>
              <td className="px-4 py-3">{item.stockMaximo ?? "-"}</td>
              <td className="px-4 py-3">{getStockStatus(item)}</td>
              <td className="px-4 py-3">
                {item.averageUnitCost === null
                  ? "-"
                  : CRC_FORMATTER.format(item.averageUnitCost)}
              </td>
              <td className="px-4 py-3">
                {item.totalInventoryValue === null
                  ? "-"
                  : CRC_FORMATTER.format(item.totalInventoryValue)}
              </td>
              <td className="px-4 py-3">
                {item.costStatus === "complete" ? "Completo" : "Por conciliar"}
              </td>
              <td className="px-4 py-3">
                <StockCostReconciliationForm canAdjust={canAdjust} stock={item} />
              </td>
              <td className="px-4 py-3">
                <StockLimitsForm canAdjust={canAdjust} stock={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
