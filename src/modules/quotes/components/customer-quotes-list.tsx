import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { Quote } from "@/modules/quotes/types";

type CustomerQuotesListProps = {
  clienteId: string;
  canCreate: boolean;
  quotes: Quote[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function CustomerQuotesList({
  canCreate,
  clienteId,
  quotes,
}: CustomerQuotesListProps) {
  return (
    <div className="space-y-3">
      {canCreate ? (
        <Link
          className={buttonVariants()}
          href={`/cotizaciones/nueva?clienteId=${clienteId}`}
        >
          Crear cotizacion
        </Link>
      ) : null}
      {quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
          No hay cotizaciones para este cliente.
        </div>
      ) : (
        <div className="space-y-2">
          {quotes.map((quote) => (
            <Link
              className="block rounded-lg border bg-background p-4 hover:bg-muted"
              href={`/cotizaciones/${quote.id}`}
              key={quote.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{quote.numero}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {quote.estado} - {quote.fechaEmision}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatMoney(quote.total, quote.moneda)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
