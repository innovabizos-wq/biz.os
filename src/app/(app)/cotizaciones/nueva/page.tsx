import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuoteForm } from "@/modules/quotes/components/quote-form";
import { getCustomersForQuote } from "@/modules/quotes/queries";
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
          title="Nueva cotización"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const customers = await getCustomersForQuote(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea la cotización base; los items se agregan en el detalle."
        eyebrow="Comercial"
        title="Nueva cotización"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <QuoteForm
        customers={customers.ok ? customers.data : []}
        mode="create"
        preselectedClienteId={params?.clienteId}
      />
    </section>
  );
}
