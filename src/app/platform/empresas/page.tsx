import Link from "next/link";
import { ArrowRight, Building2, HeartPulse, Search, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  PlatformBadge,
  PlatformCard,
  PlatformSectionHeader,
  statusTone,
} from "@/modules/platform-console/components";
import { getPlatformCompanies } from "@/modules/platform-console/queries";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PlatformCompaniesPage() {
  const companies = await getPlatformCompanies();

  if (!companies.ok) {
    return <EmptyState description={companies.error.message} title="Empresas" />;
  }

  const issueCount = companies.data.filter((company) => company.healthStatus === "issues").length;
  const activeCount = companies.data.filter((company) => company.status === "activa").length;

  return (
    <section className="space-y-6">
      <PlatformSectionHeader
        description="Directorio operativo de clientes SaaS. Desde aqui se revisa plan, modulos, usuarios, health y soporte de cada empresa."
        eyebrow="Clientes SaaS"
        title="Empresas"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <PlatformCard>
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-blue-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Total empresas</p>
              <strong className="text-2xl font-black text-slate-950">{companies.data.length}</strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <Users className="size-5 text-emerald-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Activas</p>
              <strong className="text-2xl font-black text-slate-950">{activeCount}</strong>
            </div>
          </div>
        </PlatformCard>
        <PlatformCard>
          <div className="flex items-center gap-3">
            <HeartPulse className="size-5 text-rose-700" aria-hidden />
            <div>
              <p className="text-sm font-bold text-slate-500">Con alertas</p>
              <strong className="text-2xl font-black text-slate-950">{issueCount}</strong>
            </div>
          </div>
        </PlatformCard>
      </div>

      <PlatformCard className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 p-4">
          <div>
            <h3 className="font-black text-slate-950">Listado operativo</h3>
            <p className="text-sm text-slate-500">
              Sin edicion destructiva en esta fase. Usa el detalle para diagnostico.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <Search className="size-4" aria-hidden />
            Filtros avanzados pendientes
          </div>
        </div>

        {companies.data.length === 0 ? (
          <div className="p-6">
            <EmptyState description="No hay empresas registradas." title="Empresas" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-blue-50 text-xs font-black uppercase tracking-wide text-blue-900">
                <tr>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Modulos</th>
                  <th className="p-3">Usuarios</th>
                  <th className="p-3">Alta</th>
                  <th className="p-3">Health</th>
                  <th className="p-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.data.map((company) => (
                  <tr className="transition hover:bg-blue-50/60" key={company.id}>
                    <td className="p-3">
                      <strong className="block text-slate-950">{company.name}</strong>
                      <span className="text-xs text-slate-500">{company.id}</span>
                    </td>
                    <td className="p-3">
                      <PlatformBadge tone={statusTone(company.status)}>{company.status}</PlatformBadge>
                    </td>
                    <td className="p-3 text-slate-700">{company.planName ?? "Sin plan"}</td>
                    <td className="p-3 font-bold text-slate-900">{company.activeModules}</td>
                    <td className="p-3 font-bold text-slate-900">{company.users}</td>
                    <td className="p-3 text-slate-600">{formatDate(company.createdAt)}</td>
                    <td className="p-3">
                      <PlatformBadge tone={statusTone(company.healthStatus)}>
                        {company.healthStatus === "issues"
                          ? "Revisar"
                          : company.healthStatus === "healthy"
                            ? "Sano"
                            : "Sin datos"}
                      </PlatformBadge>
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
                        href={`/platform/empresas/${company.id}`}
                      >
                        Ver empresa
                        <ArrowRight className="size-3" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PlatformCard>
    </section>
  );
}

