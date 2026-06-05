import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { FloatingQuoteButton } from "@/modules/quotes/components/floating-quote-button";
import {
  getActiveCatalogProductsForQuote,
  getCustomersForQuote,
} from "@/modules/quotes/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewQuotePageProps = {
  searchParams?: Promise<{ clienteId?: string; error?: string }>;
};

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canCreate = hasPermission(access.tenant.permissions, "quotes.create");

  if (!canCreate) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para crear cotizaciones."
          eyebrow="Comercial"
          title="Nueva cotizacion"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [customers, activeProducts] = await Promise.all([
    getCustomersForQuote(access.tenant),
    getActiveCatalogProductsForQuote(access.tenant),
  ]);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Arma la proforma primero. La cotizacion y su numero se crean al final."
        eyebrow="Comercial"
        title="Nueva cotizacion"
      />

      <EphemeralPageAlert error={params?.error} />

      <div className="rounded-lg border border-dashed bg-background p-6 text-sm text-muted-foreground">
        El constructor esta abierto. Agrega cliente e items; el boton Crear
        cotizacion guardara todo y asignara el numero.
      </div>

      <FloatingQuoteButton
        activeProducts={activeProducts.ok ? activeProducts.data : []}
        customers={customers.ok ? customers.data : []}
        hideTrigger
        initialOpen
        preselectedClienteId={params?.clienteId}
      />
    </section>
  );
}
