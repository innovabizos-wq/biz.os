import type { Quote } from "@/modules/quotes/types";

type QuoteSummaryCardProps = {
  quote: Quote;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function QuoteSummaryCard({ quote }: QuoteSummaryCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Subtotal</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(quote.subtotal, quote.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Descuento</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(quote.descuentoTotal, quote.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Impuesto</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(quote.impuestoTotal, quote.moneda)}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="mt-2 text-xl font-semibold">
          {formatMoney(quote.total, quote.moneda)}
        </p>
      </div>
    </div>
  );
}
