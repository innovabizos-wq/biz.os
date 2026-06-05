import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { Sale } from "@/modules/sales/types";

type CustomerSalesListProps = {
  sales: Sale[];
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-CR", {
    currency,
    style: "currency",
  }).format(value);
}

function statusLabel(status: Sale["estado"]) {
  const labels: Record<Sale["estado"], string> = {
    cancelada: "Cancelada",
    completada: "Completada",
    confirmada: "Confirmada",
    en_proceso: "En proceso",
    nueva: "Nueva",
  };

  return labels[status];
}

export function CustomerSalesList({ sales }: CustomerSalesListProps) {
  if (sales.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        Este cliente aun no tiene ventas registradas.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Venta</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr className="border-t" key={sale.id}>
              <td className="px-4 py-3 font-semibold">{sale.numero}</td>
              <td className="px-4 py-3">{statusLabel(sale.estado)}</td>
              <td className="px-4 py-3">{sale.fechaVenta}</td>
              <td className="px-4 py-3">{formatMoney(sale.total, sale.moneda)}</td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/ventas/${sale.id}`}
                >
                  Ver venta
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
