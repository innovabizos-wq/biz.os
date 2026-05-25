import { changeDispatchStatusAction } from "@/modules/dispatch/actions";
import type { DispatchOrder, DispatchStatus } from "@/modules/dispatch/types";
import { Button } from "@/components/ui/button";

type DispatchStatusActionsProps = {
  canChangeStatus: boolean;
  dispatch: DispatchOrder;
};

function getNextStatuses(status: DispatchStatus): DispatchStatus[] {
  if (status === "pendiente") {
    return ["preparando", "fallido", "cancelado"];
  }

  if (status === "preparando") {
    return ["listo", "fallido", "cancelado"];
  }

  if (status === "listo") {
    return ["en_ruta", "fallido", "cancelado"];
  }

  if (status === "en_ruta") {
    return ["entregado", "fallido", "cancelado"];
  }

  return [];
}

export function DispatchStatusActions({
  canChangeStatus,
  dispatch,
}: DispatchStatusActionsProps) {
  const nextStatuses = getNextStatuses(dispatch.estado);

  if (!canChangeStatus || nextStatuses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <form action={changeDispatchStatusAction} key={status}>
            <input name="despachoId" type="hidden" value={dispatch.id} />
            <input name="estado" type="hidden" value={status} />
            <Button
              size="sm"
              type="submit"
              variant={status === "cancelado" || status === "fallido" ? "destructive" : "outline"}
            >
              {status}
            </Button>
          </form>
        ))}
      </div>
      <form action={changeDispatchStatusAction} className="flex flex-wrap items-end gap-2">
        <input name="despachoId" type="hidden" value={dispatch.id} />
        <input name="estado" type="hidden" value={dispatch.estado} />
        <label className="space-y-1 text-sm">
          <span className="font-medium">Resultado</span>
          <input
            className="h-9 min-w-64 rounded-md border bg-background px-3 text-sm"
            defaultValue={dispatch.resultado ?? ""}
            name="resultado"
          />
        </label>
        <Button size="sm" type="submit" variant="outline">
          Guardar resultado
        </Button>
      </form>
    </div>
  );
}
