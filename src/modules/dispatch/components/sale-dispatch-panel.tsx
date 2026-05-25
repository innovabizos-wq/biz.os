import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { DispatchForm } from "@/modules/dispatch/components/dispatch-form";
import type {
  DispatchAssignableUser,
  DispatchOrder,
} from "@/modules/dispatch/types";
import type { Sale } from "@/modules/sales/types";

type SaleDispatchPanelProps = {
  canCreate: boolean;
  dispatch: DispatchOrder | null;
  sale: Sale;
  users: DispatchAssignableUser[];
};

export function SaleDispatchPanel({
  canCreate,
  dispatch,
  sale,
  users,
}: SaleDispatchPanelProps) {
  const canCreateForStatus = ["confirmada", "en_proceso", "completada"].includes(
    sale.estado,
  );

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-semibold">Despacho</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Entrega o trabajo operativo derivado de esta venta.
            </p>
          </div>
          {dispatch ? (
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={`/despacho/${dispatch.id}`}
            >
              Ver despacho {dispatch.numero}
            </Link>
          ) : null}
        </div>
        {dispatch ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Estado actual: {dispatch.estado}
          </p>
        ) : !canCreateForStatus ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Para crear despacho, la venta debe estar confirmada, en proceso o
            completada.
          </p>
        ) : null}
      </div>

      {!dispatch && canCreate && canCreateForStatus ? (
        <DispatchForm mode="create" users={users} ventaId={sale.id} />
      ) : null}
    </section>
  );
}
