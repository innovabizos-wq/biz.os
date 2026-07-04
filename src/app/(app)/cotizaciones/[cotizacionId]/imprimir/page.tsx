import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuotePrintButton } from "@/modules/quotes/components/quote-print-button";
import { QuotePrintDocument } from "@/modules/quotes/components/quote-print-document";
import { getQuoteDetail, getQuoteItems } from "@/modules/quotes/queries";
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

  const [quote, items] = await Promise.all([
    getQuoteDetail(access.tenant, cotizacionId),
    getQuoteItems(access.tenant, cotizacionId),
  ]);

  if (!quote.ok || !quote.data) {
    notFound();
  }

  const itemRows = items.ok ? items.data : [];

  return (
    <section className="space-y-6">
      <style>{`
        @media print {
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

      <QuotePrintDocument items={itemRows} quote={quote.data} />
    </section>
  );
}
