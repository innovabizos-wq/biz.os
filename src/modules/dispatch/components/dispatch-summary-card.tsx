import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { DispatchOrder } from "@/modules/dispatch/types";

type DispatchSummaryCardProps = {
  dispatch: DispatchOrder;
};

function formatMoney(value: number | null) {
  if (value === null) {
    return "No disponible";
  }

  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    style: "currency",
  }).format(value);
}

export function DispatchSummaryCard({ dispatch }: DispatchSummaryCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Cliente</p>
        <p className="mt-2 font-semibold">{dispatch.clienteNombre ?? "Sin cliente"}</p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Venta origen</p>
        <Link
          className={buttonVariants({ className: "mt-2", size: "sm", variant: "outline" })}
          href={`/ventas/${dispatch.ventaId}`}
        >
          {dispatch.ventaNumero ?? "Ver venta"}
        </Link>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Total venta</p>
        <p className="mt-2 font-semibold">{formatMoney(dispatch.totalVenta)}</p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Responsable</p>
        <p className="mt-2 font-semibold">
          {dispatch.responsableNombre ?? "Sin responsable"}
        </p>
      </div>
    </div>
  );
}
