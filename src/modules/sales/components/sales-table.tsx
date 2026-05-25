import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Sale } from "@/modules/sales/types";

type SalesTableProps = {
  className?: string;
  sales: Sale[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

export function SalesTable({ className, sales }: SalesTableProps) {
  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Cotizacion</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Moneda</th>
            <th className="px-4 py-3">Creado por</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr className="border-t" key={sale.id}>
              <td className="px-4 py-3 font-medium">{sale.numero}</td>
              <td className="px-4 py-3">{sale.clienteNombre ?? "Sin cliente"}</td>
              <td className="px-4 py-3">
                {sale.cotizacionNumero ?? "Sin cotizacion"}
              </td>
              <td className="px-4 py-3">{sale.estado}</td>
              <td className="px-4 py-3">{sale.fechaVenta}</td>
              <td className="px-4 py-3">{formatMoney(sale.total, sale.moneda)}</td>
              <td className="px-4 py-3">{sale.moneda}</td>
              <td className="px-4 py-3">
                {sale.creadoPorNombre ?? "No disponible"}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/ventas/${sale.id}`}
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
