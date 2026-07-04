import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  HeartPulse,
  Smartphone,
  Users,
} from "lucide-react";

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

  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MetricCard({
  help,
  href,
  icon: Icon,
  label,
  tone,
  value,
}: {
  help: string;
  href: string;
  icon: typeof Building2;
  label: string;
  tone: "blue" | "green" | "amber" | "red";
  value: number;
}) {
  const toneClasses = {
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-rose-50 text-rose-700 ring-rose-100",
  };

  return (
    <Link href={href}>
      <PlatformCard className="h-full transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-600">{label}</p>
            <strong className="mt-2 block text-3xl font-black text-slate-950">{value}</strong>
          </div>
          <span className={`rounded-lg p-2 ring-1 ${toneClasses[tone]}`}>
            <Icon className="size-5" aria-hidden />
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">{help}</p>
      </PlatformCard>
    </Link>
  );
}

export default async function PlatformDashboardPage() {
  const summary = await getPlatformSummary();

  if (!summary.ok) {
    return (
      <EmptyState
        description={summary.error.message}
        title="No se pudo cargar Platform Console"
      />
    );
  }

  const hasOperationalIssues =
    summary.data.healthErrors > 0 ||
    summary.data.integrationErrors > 0 ||
    summary.data.whappPendingChannels > 0;

  return (
    <section className="space-y-8">
      <PlatformSectionHeader
        action={
          <Link
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700"
            href="/platform/empresas"
          >
            Administrar empresas
          </Link>
        }
        description="Esta consola sirve para operar todas las empresas cliente desde AInovaCR: revisar estado, detectar errores, dar soporte y supervisar Whapp sin exponer secretos."
        eyebrow="Centro de operacion SaaS"
        title="Resumen general"
      />

      <PlatformCard className="border-blue-200 bg-blue-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-blue-950">
              {hasOperationalIssues ? "Hay puntos que revisar" : "Operacion estable"}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-blue-800">
              Usa esta pantalla como tablero inicial: si algo sale en amarillo o rojo,
              entra al detalle de empresa para ver modulos, usuarios, health, Whapp y billing.
            </p>
          </div>
          <PlatformBadge tone={hasOperationalIssues ? "amber" : "green"}>
            {hasOperationalIssues ? "Requiere atencion" : "Sin alertas criticas"}
          </PlatformBadge>
        </div>
      </PlatformCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          help="Clientes registrados en biz.os."
          href="/platform/empresas"
          icon={Building2}
          label="Empresas"
          tone="blue"
          value={summary.data.companies}
        />
        <MetricCard
          help="Empresas operando normalmente."
          href="/platform/empresas"
          icon={CheckCircle2}
          label="Activas"
          tone="green"
          value={summary.data.activeCompanies}
        />
        <MetricCard
          help="Empresas bloqueadas o detenidas."
          href="/platform/empresas"
          icon={AlertTriangle}
          label="Suspendidas"
          tone="amber"
          value={summary.data.suspendedCompanies}
        />
        <MetricCard
          help="Modulos con configuracion incompleta o error."
          href="/platform/health"
          icon={HeartPulse}
          label="Health"
          tone={summary.data.healthErrors > 0 ? "red" : "green"}
          value={summary.data.healthErrors}
        />
        <MetricCard
          help="Canales WhatsApp que necesitan provision o revision."
          href="/platform/whapp"
          icon={Smartphone}
          label="Whapp"
          tone={summary.data.whappPendingChannels > 0 ? "amber" : "green"}
          value={summary.data.whappPendingChannels}
        />
        <MetricCard
          help="Errores tecnicos visibles para soporte."
          href="/platform/health"
          icon={Users}
          label="Integraciones"
          tone={summary.data.integrationErrors > 0 ? "red" : "green"}
          value={summary.data.integrationErrors}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Empresas recientes</h3>
              <p className="text-sm text-slate-500">Ultimos clientes creados.</p>
            </div>
            <Link className="text-sm font-bold text-blue-700" href="/platform/empresas">
              Ver todas
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {summary.data.latestCompanies.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No hay empresas registradas.</p>
            ) : (
              summary.data.latestCompanies.map((company) => (
                <Link
                  className="flex items-center justify-between gap-3 py-3 transition hover:text-blue-700"
                  href={`/platform/empresas/${company.id}`}
                  key={company.id}
                >
                  <span>
                    <strong className="block text-slate-950">{company.name}</strong>
                    <span className="text-sm text-slate-500">{formatDate(company.createdAt)}</span>
                  </span>
                  <PlatformBadge tone={statusTone(company.status)}>{company.status}</PlatformBadge>
                </Link>
              ))
            )}
          </div>
        </PlatformCard>

        <PlatformCard>
          <div>
            <h3 className="text-lg font-black text-slate-950">Errores recientes</h3>
            <p className="text-sm text-slate-500">Problemas de modulos o integraciones.</p>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {summary.data.latestHealthErrors.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">No hay errores recientes.</p>
            ) : (
              summary.data.latestHealthErrors.map((item) => (
                <div className="py-3" key={`${item.companyId}-${item.moduleCode}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-950">
                      {item.companyName ?? item.companyId}
                    </strong>
                    <PlatformBadge tone={statusTone(item.status)}>{item.status}</PlatformBadge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.moduleCode}: {item.lastError ?? "Sin detalle"}
                  </p>
                </div>
              ))
            )}
          </div>
        </PlatformCard>
      </div>
    </section>
  );
}

