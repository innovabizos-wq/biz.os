import Link from "next/link";
import { ArrowRight, CheckCircle2, HeartPulse } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  PlatformBadge,
  PlatformCard,
  PlatformSectionHeader,
  statusTone,
} from "@/modules/platform-console/components";
import { getPlatformSummary } from "@/modules/platform-console/queries";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";

  return new Date(value).toLocaleString("es-CR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PlatformHealthPage() {
  const summary = await getPlatformSummary();

  if (!summary.ok) {
    return <EmptyState description={summary.error.message} title="Health" />;
  }

  return (
    <section className="space-y-6">
      <PlatformSectionHeader
        description="Vista de diagnostico global para priorizar soporte. Muestra problemas de modulos e integraciones sin exponer secretos."
        eyebrow="Health"
        title="Health global"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <PlatformCard>
          <div className="flex items-center gap-3">
            <HeartPulse className="size-5 text-rose-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Errores health</p>
              <strong className="text-2xl font-black text-slate-950">
                {summary.data.healthErrors}
              </strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <HeartPulse className="size-5 text-amber-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Integraciones con error</p>
              <strong className="text-2xl font-black text-slate-950">
                {summary.data.integrationErrors}
              </strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Whapp pendientes</p>
              <strong className="text-2xl font-black text-slate-950">
                {summary.data.whappPendingChannels}
              </strong>
            </div>
          </div>
        </PlatformCard>
      </div>

      {summary.data.latestHealthErrors.length === 0 ? (
        <PlatformCard>
          <EmptyState description="No hay modulos criticos con problema." title="Health" />
        </PlatformCard>
      ) : (
        <div className="grid gap-3">
          {summary.data.latestHealthErrors.map((item) => (
            <PlatformCard key={`${item.companyId}-${item.moduleCode}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-slate-950">
                      {item.companyName ?? item.companyId}
                    </strong>
                    <PlatformBadge tone={statusTone(item.status)}>{item.status}</PlatformBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.moduleCode} - config {item.configurationComplete ? "si" : "no"} -
                    credenciales {item.credentialsPresent ? "si" : "no"}
                  </p>
                  <p className="mt-2 text-sm text-rose-700">
                    {item.lastError ?? "Sin detalle"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Ultimo error: {formatDate(item.lastErrorAt)}
                  </p>
                </div>
                <Link
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                  href={`/platform/empresas/${item.companyId}`}
                >
                  Ver empresa
                  <ArrowRight className="size-3" aria-hidden />
                </Link>
              </div>
            </PlatformCard>
          ))}
        </div>
      )}
    </section>
  );
}

