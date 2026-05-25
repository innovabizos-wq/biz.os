import Link from "next/link";

import type { AgendaFollowup, AgendaSummary } from "@/modules/agenda/types";

type FollowupsBoardProps = {
  summary: AgendaSummary;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es");
}

function FollowupPreviewList({ followups }: { followups: AgendaFollowup[] }) {
  if (followups.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin seguimientos.</p>;
  }

  return (
    <div className="space-y-3">
      {followups.slice(0, 4).map((followup) => (
        <div
          className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm"
          key={followup.seguimientoId}
        >
          <Link
            className="text-sm font-medium hover:underline"
            href={`/crm/clientes/${followup.clienteId}`}
          >
            {followup.clienteNombre}
          </Link>
          <p className="mt-1 text-sm">{followup.asunto}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(followup.fechaProgramada)}
          </p>
        </div>
      ))}
    </div>
  );
}

export function FollowupsBoard({ summary }: FollowupsBoardProps) {
  const groups = [
    {
      followups: summary.vencidos,
      title: "Vencidos",
    },
    {
      followups: summary.hoy,
      title: "Hoy",
    },
    {
      followups: summary.proximos,
      title: "Próximos",
    },
    {
      followups: summary.completadosRecientes,
      title: "Completados recientes",
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {groups.map((group) => (
        <section className="space-y-3" key={group.title}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-muted-foreground">
              {group.followups.length}
            </span>
          </div>
          <FollowupPreviewList followups={group.followups} />
        </section>
      ))}
    </div>
  );
}
