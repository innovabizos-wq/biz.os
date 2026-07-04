import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { recoverPendingFiscalDocumentsAction } from "@/modules/billing/actions";
import { canUseBilling } from "@/modules/billing/guards";
import {
  getBillingDashboardSummary,
  getReceivedFiscalDocuments,
} from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type BillingReportsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function BillingReportsPage({ searchParams }: BillingReportsPageProps) {
  const defaultSearchParams: { error?: string; success?: string } = {};
  const [access, query] = await Promise.all([
    requireAdminAccess(),
    searchParams ?? Promise.resolve(defaultSearchParams),
  ]);

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  const [summary, receivedDocuments] = await Promise.all([
    getBillingDashboardSummary(access.tenant),
    getReceivedFiscalDocuments(access.tenant),
  ]);
  const data = summary.ok ? summary.data : null;
  const received = receivedDocuments.ok ? receivedDocuments.data : [];
  const receivedWithErrors = received.filter((document) => document.validationErrors.length > 0);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Reportes basicos sobre documentos fiscales internos. No inventa datos ni usa ventas sin documento fiscal."
        eyebrow="Facturacion"
        title="Reportes fiscales"
      />
      {query.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900">
          {query.error}
        </div>
      ) : null}

      {query.success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {query.success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-2 text-2xl font-black">{data?.pendingCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Aceptados</p>
          <p className="mt-2 text-2xl font-black">{data?.acceptedCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Rechazados</p>
          <p className="mt-2 text-2xl font-black">{data?.rejectedCount ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">XML recibidos</p>
          <p className="mt-2 text-2xl font-black">{received.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-sm text-muted-foreground">Recepcion con errores</p>
          <p className="mt-2 text-2xl font-black">{receivedWithErrors.length}</p>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4">
        <h2 className="font-black">Cobertura del reporte</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Este reporte usa documentos fiscales internos y XML recibidos registrados. No cuenta ventas
          sin documento fiscal ni marca aceptaciones sin respuesta oficial.
        </p>
      </div>

      <form action={recoverPendingFiscalDocumentsAction} className="rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-black">Recuperacion fiscal manual</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Revisa documentos pendientes o temporales de la empresa actual. Solo consulta Hacienda
              para documentos ya enviados/procesando; no genera, firma ni envia XML por su cuenta.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
              defaultValue="10"
              max="25"
              min="1"
              name="limit"
              type="number"
            />
            <button className="rounded-md bg-slate-950 px-4 py-2 text-sm font-black text-white" type="submit">
              Revisar
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
