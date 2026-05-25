import {
  cancelAgendaFollowupAction,
  completeAgendaFollowupAction,
  reopenAgendaFollowupAction,
} from "@/modules/agenda/actions";
import type { AgendaFollowup } from "@/modules/agenda/types";
import { Button } from "@/components/ui/button";

type FollowupStatusActionsProps = {
  canEdit: boolean;
  followup: AgendaFollowup;
  returnTo: string;
};

export function FollowupStatusActions({
  canEdit,
  followup,
  returnTo,
}: FollowupStatusActionsProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {followup.estado !== "completado" ? (
        <form action={completeAgendaFollowupAction}>
          <input name="clienteId" type="hidden" value={followup.clienteId} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="seguimientoId" type="hidden" value={followup.seguimientoId} />
          <Button size="sm" type="submit">
            Completar
          </Button>
        </form>
      ) : null}
      {followup.estado !== "cancelado" ? (
        <form action={cancelAgendaFollowupAction}>
          <input name="clienteId" type="hidden" value={followup.clienteId} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="seguimientoId" type="hidden" value={followup.seguimientoId} />
          <Button size="sm" type="submit" variant="outline">
            Cancelar
          </Button>
        </form>
      ) : null}
      {followup.estado !== "pendiente" ? (
        <form action={reopenAgendaFollowupAction}>
          <input name="clienteId" type="hidden" value={followup.clienteId} />
          <input name="returnTo" type="hidden" value={returnTo} />
          <input name="seguimientoId" type="hidden" value={followup.seguimientoId} />
          <Button size="sm" type="submit" variant="outline">
            Reabrir
          </Button>
        </form>
      ) : null}
    </div>
  );
}
