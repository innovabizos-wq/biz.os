import Link from "next/link";

import {
  formatAgendaTime,
  getAgendaEventClass,
} from "@/modules/agenda/components/agenda-calendar-utils";
import type { AgendaFollowup } from "@/modules/agenda/types";

type AgendaUpcomingPanelProps = {
  followups: AgendaFollowup[];
};

export function AgendaUpcomingPanel({ followups }: AgendaUpcomingPanelProps) {
  const upcoming = [...followups]
    .sort(
      (left, right) =>
        new Date(left.fechaProgramada).getTime() -
        new Date(right.fechaProgramada).getTime(),
    )
    .slice(0, 4);

  return (
    <section className="min-h-0 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-950">Proximos</h3>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
          {upcoming.length}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {upcoming.length > 0 ? (
          upcoming.map((followup, index) => (
            <Link
              className={`block rounded-2xl border p-3 text-sm ${getAgendaEventClass(
                followup,
                index,
              )}`}
              href={`/crm/clientes/${followup.clienteId}`}
              key={followup.seguimientoId}
            >
              <p className="line-clamp-1 font-semibold">{followup.asunto}</p>
              <p className="mt-1 line-clamp-1 text-xs opacity-70">
                {formatAgendaTime(followup.fechaProgramada)} - {followup.clienteNombre}
              </p>
            </Link>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">
            Sin seguimientos esta semana.
          </p>
        )}
      </div>
    </section>
  );
}
