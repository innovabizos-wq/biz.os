import type { Sale } from "@/modules/sales/types";

type SaleSummaryCardProps = {
  sale: Sale;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function SaleSummaryCard({ sale }: SaleSummaryCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Subtotal</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(sale.subtotal, sale.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Descuento</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(sale.descuentoTotal, sale.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Impuesto</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(sale.impuestoTotal, sale.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(sale.total, sale.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Inventario</p>
        <p className="mt-2 text-xl font-semibold">{sale.inventarioEstado}</p>
      </div>
    </div>
  );
}
