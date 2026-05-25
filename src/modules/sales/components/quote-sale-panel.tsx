import Link from "next/link";

import { buttonVariants, Button } from "@/components/ui/button";
import { generateSaleFromQuoteAction } from "@/modules/sales/actions";
import type { Sale } from "@/modules/sales/types";
import type { Quote } from "@/modules/quotes/types";

type QuoteSalePanelProps = {
  canCreateSale: boolean;
  quote: Quote;
  sale: Sale | null;
};

export function QuoteSalePanel({
  canCreateSale,
  quote,
  sale,
}: QuoteSalePanelProps) {
  if (sale) {
    return (
      <section className="space-y-3 rounded-lg border bg-background p-5">
        <div>
          <h3 className="text-base font-semibold">Venta / Orden</h3>
          <p className="mt-1 text-sm text-muted-foreground">
          Esta cotización ya generó la venta {sale.numero}.
          </p>
        </div>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/ventas/${sale.id}`}
        >
          Ver venta
        </Link>
      </section>
    );
  }

  if (quote.estado !== "aceptada") {
    return (
      <section className="rounded-lg border bg-background p-5">
        <h3 className="text-base font-semibold">Venta / Orden</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Para generar una venta, la cotización debe estar aceptada.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border bg-background p-5">
      <div>
        <h3 className="text-base font-semibold">Venta / Orden</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Genera una venta congelando cliente, items, precios y totales.
        </p>
      </div>
      {canCreateSale ? (
        <form action={generateSaleFromQuoteAction}>
          <input name="cotizacionId" type="hidden" value={quote.id} />
          <Button type="submit">Generar venta</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          No tienes permiso para generar ventas.
        </p>
      )}
    </section>
  );
}
