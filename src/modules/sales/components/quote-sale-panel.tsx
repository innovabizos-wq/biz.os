import Link from "next/link";

import { buttonVariants, Button } from "@/components/ui/button";
import { confirmSaleFromQuoteAction } from "@/modules/quotes/actions";
import type { Quote } from "@/modules/quotes/types";
import type { Sale } from "@/modules/sales/types";

type QuoteSalePanelProps = {
  canConfirmSale: boolean;
  itemsCount: number;
  quote: Quote;
  sale: Sale | null;
};

export function QuoteSalePanel({
  canConfirmSale,
  itemsCount,
  quote,
  sale,
}: QuoteSalePanelProps) {
  if (sale) {
    return (
      <section className="space-y-3 rounded-lg border bg-background p-5">
        <div>
          <h3 className="text-base font-semibold">Orden de venta</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta cotizacion ya fue convertida en la venta {sale.numero}.
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

  if (itemsCount === 0) {
    return (
      <section className="rounded-lg border bg-background p-5">
        <h3 className="text-base font-semibold">Crear orden de venta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Agrega al menos un item antes de confirmar la venta.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border bg-background p-5">
      <div>
        <h3 className="text-base font-semibold">Crear orden de venta</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirmar venta convierte esta cotizacion en una orden de venta y
          congela cliente, items y total para continuar con inventario y despacho.
        </p>
      </div>
      {canConfirmSale ? (
        <form action={confirmSaleFromQuoteAction}>
          <input name="cotizacionId" type="hidden" value={quote.id} />
          <Button type="submit">Confirmar venta</Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          No tienes permiso para confirmar ventas.
        </p>
      )}
    </section>
  );
}
