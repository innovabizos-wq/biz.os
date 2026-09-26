import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuotePrintButton } from "@/modules/quotes/components/quote-print-button";
import { QuotePrintDocument } from "@/modules/quotes/components/quote-print-document";
import { getQuoteDocumentSettings } from "@/modules/quotes/document-settings";
import { getQuoteDetail, getQuoteItems } from "@/modules/quotes/queries";
import { getCurrentEmpresa } from "@/modules/companies/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type QuotePrintPageProps = {
  params: Promise<{ cotizacionId: string }>;
};

export default async function QuotePrintPage({ params }: QuotePrintPageProps) {
  const [{ cotizacionId }, access] = await Promise.all([
    params,
    requireAdminAccess(),
  ]);

  if (!hasPermission(access.tenant.permissions, "quotes.view")) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para imprimir esta cotizacion."
          eyebrow="Comercial"
          title="Cotizacion imprimible"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [quote, items, company, settings] = await Promise.all([
    getQuoteDetail(access.tenant, cotizacionId),
    getQuoteItems(access.tenant, cotizacionId),
    getCurrentEmpresa(access.tenant),
    getQuoteDocumentSettings(access.tenant),
  ]);

  if (!quote.ok || !quote.data) {
    notFound();
  }

  const itemRows = items.ok ? items.data : [];

  return (
    <section className="space-y-6">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: #ffffff !important;
          }

          .app-sidebar-shell,
          .app-notification-topbar,
          .app-session-topbar,
          .floating-inbox-trigger,
          [data-print-hidden="true"] {
            display: none !important;
          }

          main {
            padding: 0 !important;
          }
        }
      `}</style>

      <div
        className="flex flex-wrap items-center justify-between gap-4"
        data-print-hidden="true"
      >
        <SectionHeader
          description="Version lista para imprimir o guardar como PDF desde el navegador."
          eyebrow="Comercial"
          title={`Documento ${quote.data.numero}`}
        />
        <div className="flex flex-wrap gap-3">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/cotizaciones/${quote.data.id}`}
          >
            Volver
          </Link>
          <QuotePrintButton />
        </div>
      </div>

      <QuotePrintDocument
        company={{
          email: company.ok ? company.data?.correo ?? null : null,
          identification: company.ok ? company.data?.identificacionFiscal ?? null : null,
          name: company.ok ? company.data?.nombre ?? "Biz.OS" : "Biz.OS",
          phone: company.ok ? company.data?.telefono ?? null : null,
          tradeName: company.ok ? company.data?.nombreComercial ?? null : null,
        }}
        items={itemRows}
        quote={quote.data}
        settings={settings}
      />
    </section>
  );
}
