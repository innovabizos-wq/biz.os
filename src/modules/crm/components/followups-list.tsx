import { changeFollowupStatusAction } from "@/modules/crm/actions";
import type { CrmFollowup } from "@/modules/crm/types";
import { Button } from "@/components/ui/button";

type FollowupsListProps = {
  clienteId: string;
  canEdit: boolean;
  followups: CrmFollowup[];
};

export function FollowupsList({
  canEdit,
  clienteId,
  followups,
}: FollowupsListProps) {
  if (followups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        No hay seguimientos registrados.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {followups.map((followup) => (
        <article className="rounded-lg border bg-background p-4" key={followup.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{followup.asunto}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {new Date(followup.fechaProgramada).toLocaleString("es")} ·{" "}
                {followup.estado}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Asignado a {followup.asignadoNombre ?? "sin asignar"}
              </p>
              {followup.descripcion ? (
                <p className="mt-2 text-sm">{followup.descripcion}</p>
              ) : null}
            </div>
            {canEdit ? (
              <div className="flex gap-2">
                <form action={changeFollowupStatusAction}>
                  <input name="clienteId" type="hidden" value={clienteId} />
                  <input name="seguimientoId" type="hidden" value={followup.id} />
                  <input name="estado" type="hidden" value="completado" />
                  <Button size="sm" type="submit">
                    Completar
                  </Button>
                </form>
                <form action={changeFollowupStatusAction}>
                  <input name="clienteId" type="hidden" value={clienteId} />
                  <input name="seguimientoId" type="hidden" value={followup.id} />
                  <input name="estado" type="hidden" value="cancelado" />
                  <Button size="sm" type="submit" variant="outline">
                    Cancelar
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
