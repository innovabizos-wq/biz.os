import { CheckCircle2, FileText, Send, Target } from "lucide-react";

import { PremiumKpiCard } from "@/components/kpi/premium-kpi-card";
import { PremiumKpiGrid } from "@/components/kpi/premium-kpi-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { FloatingQuoteButton } from "@/modules/quotes/components/floating-quote-button";
import { QuotesDatabase } from "@/modules/quotes/components/quotes-database";
import {
  getActiveCatalogProductsForQuote,
  getCustomersForQuote,
  getQuotes,
} from "@/modules/quotes/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type QuotesPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CR", {
    currency: "CRC",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasPermission(access.tenant.permissions, "quotes.view");
  const canCreate = hasPermission(access.tenant.permissions, "quotes.create");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Comercial"
          title="Cotizaciones"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const quotes = await getQuotes(access.tenant, "todos");
  const quoteCustomers = canCreate ? await getCustomersForQuote(access.tenant) : null;
  const quoteProducts = canCreate
    ? await getActiveCatalogProductsForQuote(access.tenant)
    : null;
  const quoteRows = quotes.ok ? quotes.data : [];
  const draftAndSentQuotes = quoteRows.filter((quote) =>
    ["borrador", "enviada"].includes(quote.estado),
  );
  const acceptedQuotes = quoteRows.filter((quote) => quote.estado === "aceptada");
  const openAmount = draftAndSentQuotes.reduce((sum, quote) => sum + quote.total, 0);

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        actions={
          canCreate ? (
            <FloatingQuoteButton
              activeProducts={quoteProducts?.ok ? quoteProducts.data : []}
              customers={quoteCustomers?.ok ? quoteCustomers.data : []}
            />
          ) : null
        }
        title="Cotizaciones"
        titleClassName="app-page-title-compact normal-case"
      />

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <PremiumKpiGrid>
        <PremiumKpiCard
          footerLeftLabel="Visibles"
          footerLeftValue={quoteRows.length}
          footerRightLabel="Filtro"
          footerRightValue="todos"
          href="/cotizaciones"
          icon={<FileText />}
          sparklineTone="blue"
          title="Total cotizaciones"
          trendLabel="historico"
          trendTone="neutral"
          trendValue="Real"
          value={quoteRows.length}
          variant="blue"
        />
        <PremiumKpiCard
          footerLeftLabel="Borradores"
          footerLeftValue={
            quoteRows.filter((quote) => quote.estado === "borrador").length
          }
          footerRightLabel="Enviadas"
          footerRightValue={
            quoteRows.filter((quote) => quote.estado === "enviada").length
          }
          icon={<Send />}
          sparklineTone="gold"
          title="Borradores/enviadas"
          trendLabel="abiertas"
          trendTone="neutral"
          trendValue={`${draftAndSentQuotes.length}`}
          value={draftAndSentQuotes.length}
          variant="red"
        />
        <PremiumKpiCard
          footerLeftLabel="Aceptadas"
          footerLeftValue={acceptedQuotes.length}
          footerRightLabel="Conversion"
          footerRightValue={
            quoteRows.length > 0
              ? `${Math.round((acceptedQuotes.length / quoteRows.length) * 100)}%`
              : "0%"
          }
          icon={<CheckCircle2 />}
          sparklineTone="green"
          title="Aceptadas"
          trendLabel="ganadas"
          trendTone="positive"
          trendValue={`${acceptedQuotes.length}`}
          value={acceptedQuotes.length}
          variant="green"
        />
        <PremiumKpiCard
          footerLeftLabel="Abierto"
          footerLeftValue={formatCurrency(openAmount)}
          footerRightLabel="Docs"
          footerRightValue={draftAndSentQuotes.length}
          icon={<Target />}
          sparklineTone="purple"
          title="Monto total abierto"
          trendLabel="CRC"
          trendTone="neutral"
          trendValue="Real"
          value={formatCurrency(openAmount)}
          variant="gold"
        />
      </PremiumKpiGrid>

      {!quotes.ok ? (
        <EmptyState description={quotes.error.message} title="No se pudo cargar" />
      ) : quoteRows.length > 0 ? (
        <QuotesDatabase quotes={quoteRows} />
      ) : (
        <EmptyState
          description="Aun no hay cotizaciones visibles."
          title="Sin cotizaciones"
        />
      )}
    </section>
  );
}
