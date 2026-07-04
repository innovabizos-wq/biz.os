import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { canUseBilling } from "@/modules/billing/guards";
import { getBillingDashboardSummary } from "@/modules/billing/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

const quickLinks = [
  { href: "/facturacion/documentos", label: "Documentos fiscales" },
  { href: "/facturacion/configuracion", label: "Configuracion fiscal" },
  { href: "/facturacion/cabys", label: "CABYS" },
  { href: "/facturacion/consecutivos", label: "Consecutivos" },
  { href: "/facturacion/recepcion", label: "Recepcion" },
  { href: "/facturacion/reportes", label: "Reportes" },
];

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-lg border bg-white p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </article>
  );
}

export default async function BillingPage() {
  const access = await requireAdminAccess();

  if (!canUseBilling(access.tenant)) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Este modulo requiere activacion y permisos de facturacion."
          eyebrow="Facturacion"
          title="Modulo no disponible"
        />
        <EmptyState
          description="Activa Facturacion desde Administracion / Modulos o solicita permisos."
          title="Facturacion no esta disponible"
        />
      </section>
    );
  }

  const summary = await getBillingDashboardSummary(access.tenant);
  const data = summary.ok ? summary.data : null;

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Base fiscal para documentos electronicos de Costa Rica. La factura real requiere XML firmado y respuesta aceptada por Hacienda."
        eyebrow="Facturacion"
        title="Facturacion electronica"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Configuracion" value={data?.configStatus ?? "missing"} />
        <StatCard label="Pendientes" value={data?.pendingCount ?? 0} />
        <StatCard label="Aceptados" value={data?.acceptedCount ?? 0} />
        <StatCard label="Errores" value={data?.errorCount ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {quickLinks.map((item) => (
          <Link
            className="rounded-lg border bg-white p-4 text-sm font-bold text-slate-950 transition hover:border-slate-400"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <section className="rounded-lg border bg-white">
        <div className="border-b p-4">
          <h2 className="font-black">Documentos recientes</h2>
        </div>
        {data?.recentDocuments.length ? (
          <div className="divide-y">
            {data.recentDocuments.map((document) => (
              <Link
                className="grid gap-2 p-4 text-sm hover:bg-slate-50 md:grid-cols-[1fr_140px_140px_120px]"
                href={`/facturacion/documentos/${document.id}`}
                key={document.id}
              >
                <span className="font-semibold">{document.customerName ?? "Sin receptor"}</span>
                <span>{document.documentTypeCode}</span>
                <span>{document.status}</span>
                <span className="text-right">{document.total ?? "N/D"}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            description="Prepara documentos desde ventas confirmadas cuando la configuracion fiscal y CABYS esten listos."
            title="No hay documentos fiscales"
          />
        )}
      </section>
    </section>
  );
}
