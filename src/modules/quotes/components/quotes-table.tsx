import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Quote } from "@/modules/quotes/types";

type QuotesTableProps = {
  className?: string;
  quotes: Quote[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function QuotesTable({ className, quotes }: QuotesTableProps) {
  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Emision</th>
            <th className="px-4 py-3">Vencimiento</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Creado por</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => (
            <tr className="border-t" key={quote.id}>
              <td className="px-4 py-3 font-medium">{quote.numero}</td>
              <td className="px-4 py-3">{quote.clienteNombre ?? "Sin cliente"}</td>
              <td className="px-4 py-3">{quote.estado}</td>
              <td className="px-4 py-3">{quote.fechaEmision}</td>
              <td className="px-4 py-3">
                {quote.fechaVencimiento ?? "No definido"}
              </td>
              <td className="px-4 py-3">{formatMoney(quote.total, quote.moneda)}</td>
              <td className="px-4 py-3">
                {quote.creadoPorNombre ?? "No disponible"}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/cotizaciones/${quote.id}`}
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
