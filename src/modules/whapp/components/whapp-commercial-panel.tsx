import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { Quote } from "@/modules/quotes/types";
import type { Sale } from "@/modules/sales/types";

type WhappCommercialPanelProps = {
  clienteId: string | null;
  clienteNombre: string | null;
  quotes: Quote[];
  sales: Sale[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CR");
}

function getOpenQuoteValue(quotes: Quote[]) {
  return quotes
    .filter((quote) => ["borrador", "enviada", "vencida"].includes(quote.estado))
    .reduce((sum, quote) => sum + quote.total, 0);
}

function getClosedSalesValue(sales: Sale[]) {
  return sales
    .filter((sale) => sale.estado !== "cancelada")
    .reduce((sum, sale) => sum + sale.total, 0);
}

export function WhappCommercialPanel({
  clienteId,
  clienteNombre,
  quotes,
  sales,
}: WhappCommercialPanelProps) {
  const openQuotes = quotes.filter((quote) =>
    ["borrador", "enviada", "vencida"].includes(quote.estado),
  );
  const latestQuotes = quotes.slice(0, 3);
  const latestSales = sales.slice(0, 3);
  const currency = quotes[0]?.moneda ?? sales[0]?.moneda ?? "CRC";
  const openQuoteValue = getOpenQuoteValue(quotes);
  const salesValue = getClosedSalesValue(sales);

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Comercial</p>
          <p className="text-sm text-muted-foreground">
            {clienteNombre
              ? `Historial de ${clienteNombre}`
              : "Vincula un cliente CRM para activar historial comercial."}
          </p>
        </div>
        {clienteId ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={`/crm/clientes/${clienteId}`}
          >
            Ver CRM
          </Link>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Cotizaciones</p>
          <p className="mt-1 font-semibold">{quotes.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Abiertas</p>
          <p className="mt-1 font-semibold">{openQuotes.length}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Ventas</p>
          <p className="mt-1 font-semibold">{sales.length}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Pipeline abierto</p>
          <p className="mt-1 font-semibold">
            {formatMoney(openQuoteValue, currency)}
          </p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Vendido historico</p>
          <p className="mt-1 font-semibold">{formatMoney(salesValue, currency)}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Ultimas cotizaciones</p>
            <Link className="text-xs text-primary" href="/cotizaciones">
              Ver todas
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {latestQuotes.map((quote) => (
              <Link
                className="block rounded-md border p-3 text-sm hover:bg-muted"
                href={`/cotizaciones/${quote.id}`}
                key={quote.id}
              >
                <span className="font-medium">#{quote.numero}</span>
                <span className="ml-2 text-muted-foreground">{quote.estado}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(quote.fechaEmision)} - {formatMoney(quote.total, quote.moneda)}
                </span>
              </Link>
            ))}
            {latestQuotes.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Sin cotizaciones vinculadas.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Ultimas ventas</p>
            <Link className="text-xs text-primary" href="/ventas">
              Ver todas
            </Link>
          </div>
          <div className="mt-2 space-y-2">
            {latestSales.map((sale) => (
              <Link
                className="block rounded-md border p-3 text-sm hover:bg-muted"
                href={`/ventas/${sale.id}`}
                key={sale.id}
              >
                <span className="font-medium">#{sale.numero}</span>
                <span className="ml-2 text-muted-foreground">{sale.estado}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDate(sale.fechaVenta)} - {formatMoney(sale.total, sale.moneda)}
                </span>
              </Link>
            ))}
            {latestSales.length === 0 ? (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Sin ventas vinculadas.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <Link className={buttonVariants({ variant: "outline" })} href="/cotizaciones/nueva">
          Crear cotizacion
        </Link>
        <Link className={buttonVariants({ variant: "outline" })} href="/ventas">
          Ir a ventas
        </Link>
      </div>
    </div>
  );
}
