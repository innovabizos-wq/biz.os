import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, HeartPulse, MessageCircle, ShieldAlert } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  PlatformBadge,
  PlatformCard,
  PlatformSectionHeader,
  statusTone,
} from "@/modules/platform-console/components";
import { getPlatformCompanyDetail } from "@/modules/platform-console/queries";
import type { JsonRecord } from "@/types/core";

type PlatformCompanyDetailPageProps = {
  params: Promise<{ empresaId: string }>;
};

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

function jsonCount(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" ? value : 0;
}

function countSummary(record: JsonRecord | undefined) {
  if (!record) return "Sin datos";

  const entries = Object.entries(record).filter(([, value]) => typeof value === "number");
  if (entries.length === 0) return "Sin datos";

  return entries.map(([key, value]) => `${key}: ${value}`).join(" | ");
}

export default async function PlatformCompanyDetailPage({
  params,
}: PlatformCompanyDetailPageProps) {
  const { empresaId } = await params;
  const detail = await getPlatformCompanyDetail(empresaId);

  if (!detail.ok) {
    return <EmptyState description={detail.error.message} title="Empresa" />;
  }

  if (!detail.data) {
    notFound();
  }

  const company = detail.data.company;
  const billingModule = detail.data.activeModules.find((module) => module.code === "billing");
  const billingHealth = detail.data.health.find((item) => item.moduleCode === "billing");
  const billingDiagnostics = detail.data.billingHealth;
  const whappHealth = detail.data.health.find((item) => item.moduleCode === "inbox");
  const healthIssues = detail.data.health.filter((item) =>
    ["misconfigured", "unhealthy"].includes(item.status),
  );

  return (
    <section className="space-y-6">
      <PlatformSectionHeader
        action={
          <Link
            className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
            href="/platform/empresas"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver a empresas
          </Link>
        }
        description={`ID interno: ${company.id}`}
        eyebrow="Detalle de cliente"
        title={company.name}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <PlatformCard>
          <p className="text-sm font-bold text-slate-500">Estado empresa</p>
          <div className="mt-3">
            <PlatformBadge tone={statusTone(company.status)}>{company.status}</PlatformBadge>
          </div>
        </PlatformCard>
        <PlatformCard>
          <p className="text-sm font-bold text-slate-500">Plan</p>
          <strong className="mt-2 block text-xl font-black text-slate-950">
            {detail.data.plan.name ?? "Sin plan"}
          </strong>
        </PlatformCard>
        <PlatformCard>
          <p className="text-sm font-bold text-slate-500">Usuarios</p>
          <strong className="mt-2 block text-xl font-black text-slate-950">
            {detail.data.users.length}
          </strong>
        </PlatformCard>
        <PlatformCard>
          <p className="text-sm font-bold text-slate-500">Alertas health</p>
          <strong className="mt-2 block text-xl font-black text-slate-950">
            {healthIssues.length}
          </strong>
        </PlatformCard>
      </div>

      <PlatformCard className="border-blue-200 bg-blue-50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-blue-950">Acciones seguras disponibles</h3>
            <p className="mt-1 text-sm text-blue-800">
              Esta fase es de soporte y diagnostico. No hay impersonacion, borrado, edicion fiscal
              sensible ni cambio de secretos desde Platform Console.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
              href="/platform/health"
            >
              <HeartPulse className="size-4" aria-hidden />
              Ver health global
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
              href="/platform/soporte"
            >
              <MessageCircle className="size-4" aria-hidden />
              Ir a soporte
            </Link>
          </div>
        </div>
      </PlatformCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformCard>
          <h3 className="text-lg font-black text-slate-950">Datos basicos</h3>
          <dl className="mt-4 grid gap-3 text-sm text-slate-700">
            <InfoRow label="Nombre comercial" value={company.tradeName ?? "No registrado"} />
            <InfoRow label="Identificacion fiscal" value={company.fiscalId ?? "No registrada"} />
            <InfoRow label="Correo" value={company.email ?? "No registrado"} />
            <InfoRow label="Telefono" value={company.phone ?? "No registrado"} />
            <InfoRow label="Alta" value={formatDate(company.createdAt)} />
            <InfoRow label="Ultima actualizacion" value={formatDate(company.updatedAt)} />
          </dl>
        </PlatformCard>

        <PlatformCard>
          <h3 className="text-lg font-black text-slate-950">Facturacion / Billing</h3>
          <dl className="mt-4 grid gap-3 text-sm text-slate-700">
            <InfoRow
              label="Modulo billing"
              value={billingModule?.status === "activo" ? "Activo" : "Inactivo o no registrado"}
            />
            <InfoRow
              label="Fiscal configurado"
              value={billingHealth?.configurationComplete ? "Si" : "No"}
            />
            <InfoRow
              label="Certificado/credenciales"
              value={billingHealth?.credentialsPresent ? "Cargadas" : "No cargadas"}
            />
            <InfoRow
              label="Ultimo error fiscal"
              value={billingDiagnostics?.lastError ?? billingHealth?.lastError ?? "Sin error registrado"}
            />
            <InfoRow
              label="Estado configuracion"
              value={billingDiagnostics?.billingConfigStatus ?? "Sin diagnostico"}
            />
            <InfoRow
              label="Ultimo Hacienda"
              value={billingDiagnostics?.lastHaciendaStatus ?? "Sin envio"}
            />
          </dl>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            Vista de estado solamente. No muestra PIN, certificado ni secretos fiscales.
          </p>
        </PlatformCard>
      </div>

      <PlatformCard>
        <h3 className="text-lg font-black text-slate-950">Diagnostico fiscal seguro</h3>
        {billingDiagnostics ? (
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Documentos</p>
              <strong className="mt-2 block text-xl text-slate-950">
                {countSummary(billingDiagnostics.documentCounts)}
              </strong>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Artefactos</p>
              <strong className="mt-2 block text-xl text-slate-950">
                {countSummary(billingDiagnostics.artifactCounts)}
              </strong>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">Recepcion</p>
              <strong className="mt-2 block text-xl text-slate-950">
                {countSummary(billingDiagnostics.receivedDocumentCounts)}
              </strong>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase text-slate-400">XML recibidos</p>
              <strong className="mt-2 block text-xl text-slate-950">
                {jsonCount(billingDiagnostics.receivedArtifactCounts, "xml_received")}
              </strong>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Sin diagnostico fiscal extendido. Verifica que la migracion billing este aplicada.
          </p>
        )}
        {billingDiagnostics?.lastReceivedValidationErrors.length ? (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Ultimo XML recibido con errores de validacion:{" "}
            {billingDiagnostics.lastReceivedValidationErrors.length} error(es).
          </div>
        ) : null}
      </PlatformCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformCard>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">Plan / modulos</h3>
            <span className="text-sm font-bold text-slate-500">
              {detail.data.activeModules.length} registrados
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {detail.data.activeModules.length === 0 ? (
              <p className="text-sm text-slate-500">Sin modulos registrados.</p>
            ) : (
              detail.data.activeModules.map((module) => (
                <div
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                  key={`${module.code}-${module.status}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-950">{module.name}</strong>
                    <PlatformBadge tone={statusTone(module.healthStatus ?? module.status)}>
                      {module.healthStatus ?? module.status}
                    </PlatformBadge>
                  </div>
                  <span className="mt-1 block text-slate-500">
                    {module.code} - {module.isCore ? "core" : "opcional"} - {module.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </PlatformCard>

        <PlatformCard>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">Usuarios</h3>
            <span className="text-sm font-bold text-slate-500">
              {detail.data.users.length} visibles
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {detail.data.users.length === 0 ? (
              <p className="text-sm text-slate-500">Sin usuarios visibles.</p>
            ) : (
              detail.data.users.map((user) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm" key={user.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-950">{user.name}</strong>
                    <PlatformBadge tone={statusTone(user.status)}>{user.status}</PlatformBadge>
                  </div>
                  <span className="mt-1 block text-slate-500">
                    {user.email} - {user.roleName ?? "Sin rol"}
                  </span>
                </div>
              ))
            )}
          </div>
        </PlatformCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PlatformCard>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-blue-700" aria-hidden />
            <h3 className="text-lg font-black text-slate-950">Health de integraciones</h3>
          </div>
          <div className="mt-4 grid gap-2">
            {detail.data.health.length === 0 ? (
              <p className="text-sm text-slate-500">Sin health registrado.</p>
            ) : (
              detail.data.health.map((item) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm" key={item.moduleCode}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-slate-950">{item.moduleCode}</strong>
                    <PlatformBadge tone={statusTone(item.status)}>{item.status}</PlatformBadge>
                  </div>
                  <span className="mt-1 block text-slate-500">
                    Config {item.configurationComplete ? "si" : "no"} - credenciales{" "}
                    {item.credentialsPresent ? "si" : "no"}
                  </span>
                  {item.lastError ? (
                    <span className="mt-2 block rounded-md bg-rose-50 p-2 text-rose-700">
                      {item.lastError}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </PlatformCard>

        <PlatformCard>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">Actividad / alertas</h3>
            <Link className="inline-flex items-center gap-1 text-sm font-bold text-blue-700" href="/platform/whapp">
              Whapp
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {whappHealth ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                <strong className="text-blue-950">Whapp / Inbox</strong>
                <p className="mt-1 text-blue-800">
                  {whappHealth.status} - {whappHealth.lastError ?? "Sin error reciente"}
                </p>
              </div>
            ) : null}
            {detail.data.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">Sin actividad reciente visible.</p>
            ) : (
              detail.data.recentActivity.map((item) => (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm" key={`${item.kind}-${item.createdAt}`}>
                  <strong className="text-slate-950">{item.description}</strong>
                  <span className="mt-1 block text-slate-500">{formatDate(item.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </PlatformCard>
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 pb-2 last:border-b-0">
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="break-words font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
