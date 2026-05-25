import { changeSaleStatusAction } from "@/modules/sales/actions";
import type { Sale, SaleStatus } from "@/modules/sales/types";
import { Button } from "@/components/ui/button";

type SaleStatusActionsProps = {
  canChangeStatus: boolean;
  sale: Sale;
};

function getNextStatuses(status: SaleStatus): SaleStatus[] {
  if (status === "nueva") {
    return ["confirmada", "cancelada"];
  }

  if (status === "confirmada") {
    return ["en_proceso", "cancelada"];
  }

  if (status === "en_proceso") {
    return ["completada", "cancelada"];
  }

  return [];
}

export function SaleStatusActions({
  canChangeStatus,
  sale,
}: SaleStatusActionsProps) {
  const nextStatuses = getNextStatuses(sale.estado);

  if (!canChangeStatus || nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((status) => (
        <form action={changeSaleStatusAction} key={status}>
          <input name="ventaId" type="hidden" value={sale.id} />
          <input name="estado" type="hidden" value={status} />
          <Button
            size="sm"
            type="submit"
            variant={status === "cancelada" ? "destructive" : "outline"}
          >
            {status}
          </Button>
        </form>
      ))}
    </div>
  );
}
