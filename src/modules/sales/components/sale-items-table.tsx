import type { Sale, SaleItem } from "@/modules/sales/types";

type SaleItemsTableProps = {
  items: SaleItem[];
  sale: Sale;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function SaleItemsTable({ items, sale }: SaleItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        No hay items en esta venta.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article className="rounded-lg border bg-background p-4" key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-medium">{item.descripcion}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.cantidad} x {formatMoney(item.precioUnitario, sale.moneda)}
              </p>
              {item.productoNombre ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Catalogo: {item.productoCodigo ? `${item.productoCodigo} - ` : ""}
                  {item.productoNombre}
                </p>
              ) : null}
            </div>
            <p className="font-semibold">{formatMoney(item.total, sale.moneda)}</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Subtotal {formatMoney(item.subtotal, sale.moneda)} - Descuento{" "}
            {formatMoney(item.descuento, sale.moneda)} - Impuesto{" "}
            {formatMoney(item.impuestoMonto, sale.moneda)}
          </p>
        </article>
      ))}
    </div>
  );
}
