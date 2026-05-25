import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuoteForm } from "@/modules/quotes/components/quote-form";
import { QuoteItemForm } from "@/modules/quotes/components/quote-item-form";
import { QuoteItemsTable } from "@/modules/quotes/components/quote-items-table";
import { QuoteStatusActions } from "@/modules/quotes/components/quote-status-actions";
import { QuoteSummaryCard } from "@/modules/quotes/components/quote-summary-card";
import { QuoteSalePanel } from "@/modules/sales/components/quote-sale-panel";
import { getSaleForQuote } from "@/modules/sales/queries";
import {
  getActiveCatalogProductsForQuote,
  getCustomersForQuote,
  getQuoteDetail,
  getQuoteItems,
} from "@/modules/quotes/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type QuoteDetailPageProps = {
  params: Promise<{ cotizacionId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function QuoteDetailPage({
  params,
  searchParams,
}: QuoteDetailPageProps) {
  const [{ cotizacionId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasPermission(access.tenant.permissions, "quotes.view");
  const canEdit = hasPermission(access.tenant.permissions, "quotes.edit");
  const canChangeStatus = hasPermission(
    access.tenant.permissions,
    "quotes.status.change",
  );
  const canCreateSale = hasPermission(
    access.tenant.permissions,
    "sales.orders.create",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Comercial"
          title="Cotización"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [quote, items, customers, catalogProducts, saleForQuote] = await Promise.all([
    getQuoteDetail(access.tenant, cotizacionId),
    getQuoteItems(access.tenant, cotizacionId),
    getCustomersForQuote(access.tenant),
    getActiveCatalogProductsForQuote(access.tenant),
    getSaleForQuote(access.tenant, cotizacionId),
  ]);

  if (!quote.ok || !quote.data) {
    notFound();
  }

  const editable = canEdit && !["aceptada", "anulada"].includes(quote.data.estado);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Detalle comercial, items manuales y estado de cotización."
        eyebrow="Comercial"
        title={quote.data.numero}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <p className="mt-1 text-lg font-semibold">{quote.data.estado}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cliente: {quote.data.clienteNombre ?? "Sin cliente"} | Emision:{" "}
              {quote.data.fechaEmision} | Vence:{" "}
              {quote.data.fechaVencimiento ?? "No definido"}
            </p>
          </div>
          <QuoteStatusActions
            canChangeStatus={canChangeStatus}
            quote={quote.data}
          />
        </div>
      </div>

      <QuoteSummaryCard quote={quote.data} />

      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Siguiente paso</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {quote.data.estado === "borrador"
            ? "Envía la cotización cuando los datos e items estén listos."
            : quote.data.estado === "enviada"
              ? "Marca la cotización como aceptada o rechazada según la respuesta del cliente."
              : quote.data.estado === "aceptada"
                ? "Genera la venta para congelar la orden comercial."
                : "Revisa el estado actual antes de continuar el proceso comercial."}
        </p>
      </div>

      <QuoteSalePanel
        canCreateSale={canCreateSale}
        quote={quote.data}
        sale={saleForQuote.ok ? saleForQuote.data : null}
      />

      {editable ? (
        <QuoteForm
          customers={customers.ok ? customers.data : []}
          mode="update"
          quote={quote.data}
        />
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          description="Items manuales o vinculados al catálogo; el precio queda histórico en la cotización."
          title="Items"
        />
        {editable ? (
          <QuoteItemForm
            activeProducts={catalogProducts.ok ? catalogProducts.data : []}
            cotizacionId={quote.data.id}
          />
        ) : null}
        <QuoteItemsTable
          activeProducts={catalogProducts.ok ? catalogProducts.data : []}
          canEdit={editable}
          items={items.ok ? items.data : []}
          quote={quote.data}
        />
      </section>

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        PDF y envío se implementarán en una fase posterior.
      </div>
    </section>
  );
}
