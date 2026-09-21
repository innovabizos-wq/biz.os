import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { retryIntegrationOutboxJobAction } from "@/modules/integrations/outbox/actions";
import type { IntegrationOutboxJobSummary } from "@/modules/integrations/outbox/types";

const STATUS_LABEL = {
  dead: "Requiere atencion",
  processing: "Procesando",
  queued: "En espera",
  retry: "Reintentando",
  succeeded: "Completada",
} as const;

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Costa_Rica",
  }).format(new Date(value));
}

function statusIcon(status: IntegrationOutboxJobSummary["status"]) {
  if (status === "dead") return <AlertTriangle aria-hidden className="text-destructive" size={18} />;
  if (status === "succeeded") return <CheckCircle2 aria-hidden className="text-emerald-600" size={18} />;
  return <Clock3 aria-hidden className="text-amber-600" size={18} />;
}

export function IntegrationOutboxPanel({
  canManage,
  jobs,
}: {
  canManage: boolean;
  jobs: IntegrationOutboxJobSummary[];
}) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Trabajos e incidencias</h2>
        <p className="text-sm text-muted-foreground">
          Facturas y conexiones que se procesan en segundo plano. Los reintentos conservan la operacion original.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 aria-hidden size={18} /> No hay trabajos pendientes ni incidencias.
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <article className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-start md:justify-between" key={job.id}>
              <div className="flex min-w-0 gap-3">
                {statusIcon(job.status)}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{job.topic === "fiscal.issue" ? "Emitir documento fiscal" : job.topic === "fiscal.status" ? "Consultar estado fiscal" : job.topic}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS_LABEL[job.status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Intento {job.attempts} de {job.maxAttempts} · actualizado {dateTime(job.updatedAt)}
                  </p>
                  {job.lastError ? <p className="mt-2 text-sm text-destructive">{job.lastError}</p> : null}
                </div>
              </div>
              {canManage && (job.status === "dead" || job.status === "retry") ? (
                <form action={retryIntegrationOutboxJobAction}>
                  <input name="jobId" type="hidden" value={job.id} />
                  <Button size="sm" type="submit" variant="outline"><RefreshCw aria-hidden /> Reintentar</Button>
                </form>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
