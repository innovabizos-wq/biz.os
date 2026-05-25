import type { SaleInventorySummaryItem } from "@/modules/sales-inventory/types";

type SaleInventoryItemsTableProps = {
  items: SaleInventorySummaryItem[];
};

function formatQuantity(value: number | null) {
  return value === null ? "-" : value.toLocaleString("es-CR");
}

export function SaleInventoryItemsTable({ items }: SaleInventoryItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Producto</th>
            <th className="px-4 py-3">Descripcion</th>
            <th className="px-4 py-3">Requerido</th>
            <th className="px-4 py-3">Inventario</th>
            <th className="px-4 py-3">Stock disponible</th>
            <th className="px-4 py-3">Estado stock</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-t" key={item.ventaItemId}>
              <td className="px-4 py-3 font-medium">
                {item.productoNombre ? (
                  <>
                    {item.productoCodigo ? `${item.productoCodigo} - ` : ""}
                    {item.productoNombre}
                  </>
                ) : (
                  "Item manual"
                )}
              </td>
              <td className="px-4 py-3">{item.descripcion}</td>
              <td className="px-4 py-3">
                {formatQuantity(item.cantidadRequerida)}
              </td>
              <td className="px-4 py-3">
                {item.requiereInventario ? "Requiere" : "No aplica"}
              </td>
              <td className="px-4 py-3">
                {formatQuantity(item.stockDisponible)}
              </td>
              <td className="px-4 py-3">
                {item.requiereInventario
                  ? item.stockSuficiente
                    ? "Suficiente"
                    : "Insuficiente"
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
