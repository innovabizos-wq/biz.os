import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { canUseBilling } from "@/modules/billing/guards";
import { getBillingDashboardSummary } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function FiscalDocumentsPage() {
  const access = await requireAdminAccess();

  if (!canUseBilling(access.tenant)) {
    return <EmptyState description="Modulo inactivo o sin permisos." title="Acceso denegado" />;
  }

  const summary = await getBillingDashboardSummary(access.tenant);
  const documents = summary.ok ? summary.data.recentDocuments : [];

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Archivo documental fiscal. Las descargas XML/PDF se habilitan cuando existan archivos generados."
        eyebrow="Facturacion"
        title="Documentos fiscales"
      />
      {documents.length ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Receptor</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Hacienda</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="p-3 font-semibold">{document.customerName ?? "Sin receptor"}</td>
                  <td className="p-3">{document.documentTypeCode}</td>
                  <td className="p-3">{document.status}</td>
                  <td className="p-3">{document.haciendaStatus}</td>
                  <td className="p-3 text-right">{document.total ?? "N/D"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          description="No hay documentos fiscales internos todavia."
          title="Archivo fiscal vacio"
        />
      )}
    </section>
  );
}
