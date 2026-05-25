import Link from "next/link";

import { buttonVariants, Button } from "@/components/ui/button";
import { reassignAgendaFollowupAction } from "@/modules/agenda/actions";
import { FollowupStatusActions } from "@/modules/agenda/components/followup-status-actions";
import type {
  AgendaAssignableUser,
  AgendaFollowup,
} from "@/modules/agenda/types";

type FollowupsTableProps = {
  assignableUsers: AgendaAssignableUser[];
  canEdit: boolean;
  followups: AgendaFollowup[];
  returnTo: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es");
}

function getStatusClass(status: AgendaFollowup["estado"]) {
  if (status === "completado") {
    return "border-emerald-100 bg-emerald-50 text-emerald-700";
  }

  if (status === "cancelado") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }

  return "border-sky-100 bg-sky-50 text-sky-700";
}

export function FollowupsTable({
  assignableUsers,
  canEdit,
  followups,
  returnTo,
}: FollowupsTableProps) {
  return (
    <div className="space-y-3">
      {followups.map((followup) => (
        <article
          className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md"
          key={followup.seguimientoId}
        >
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-medium hover:underline"
                  href={`/crm/clientes/${followup.clienteId}`}
                >
                  {followup.clienteNombre}
                </Link>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                    followup.estado,
                  )}`}
                >
                  {followup.estado}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">{followup.asunto}</p>
              {followup.descripcion ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {followup.descripcion}
                </p>
              ) : null}
            </div>

            <div className="text-sm">
              <p className="font-medium">Contacto</p>
              <p className="mt-1 text-muted-foreground">
                Tel: {followup.clienteTelefono ?? "No disponible"}
              </p>
              <p className="text-muted-foreground">
                WhatsApp: {followup.clienteWhatsapp ?? "No disponible"}
              </p>
            </div>

            <div className="text-sm">
              <p className="font-medium">{formatDate(followup.fechaProgramada)}</p>
              <p className="mt-1 text-muted-foreground">
                Asignado a {followup.asignadoNombre ?? "sin asignar"}
              </p>
              {canEdit ? (
                <form action={reassignAgendaFollowupAction} className="mt-3 flex gap-2">
                  <input name="clienteId" type="hidden" value={followup.clienteId} />
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <input
                    name="seguimientoId"
                    type="hidden"
                    value={followup.seguimientoId}
                  />
                  <select
                    className="h-9 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-xs"
                    defaultValue={followup.asignadoA ?? ""}
                    name="asignadoA"
                  >
                    <option value="">Sin asignar</option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.nombre}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" type="submit" variant="outline">
                    Asignar
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/crm/clientes/${followup.clienteId}`}
              >
                Ver cliente
              </Link>
              <FollowupStatusActions
                canEdit={canEdit}
                followup={followup}
                returnTo={returnTo}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
