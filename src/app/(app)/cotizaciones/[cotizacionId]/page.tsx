import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { QuoteForm } from "@/modules/quotes/components/quote-form";
import { QuoteItemForm } from "@/modules/quotes/components/quote-item-form";
import { QuoteItemsTable } from "@/modules/quotes/components/quote-items-table";
import { QuoteSummaryCard } from "@/modules/quotes/components/quote-summary-card";
import { getSaleForQuote } from "@/modules/sales/queries";
import { QuoteSalePanel } from "@/modules/sales/components/quote-sale-panel";
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
  const canConfirmSale =
    hasPermission(access.tenant.permissions, "quotes.status.change") &&
    hasPermission(access.tenant.permissions, "sales.orders.create") &&
    hasPermission(access.tenant.permissions, "sales.orders.status.change");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Comercial"
          title="Cotizacion"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [quote, items, customers, catalogProducts, saleForQuote] =
    await Promise.all([
      getQuoteDetail(access.tenant, cotizacionId),
      getQuoteItems(access.tenant, cotizacionId),
      getCustomersForQuote(access.tenant),
      getActiveCatalogProductsForQuote(access.tenant),
      getSaleForQuote(access.tenant, cotizacionId),
    ]);

  if (!quote.ok || !quote.data) {
    notFound();
  }

  const sale = saleForQuote.ok ? saleForQuote.data : null;
  const itemRows = items.ok ? items.data : [];
  const editable = canEdit && !sale && quote.data.estado !== "anulada";

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Detalle comercial e items de la cotizacion. El siguiente paso es confirmar venta."
        eyebrow="Comercial"
        title={quote.data.numero}
      />

      <EphemeralPageAlert error={query?.error} />

      <div className="rounded-lg border bg-background p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado comercial</p>
            <p className="mt-1 text-lg font-semibold">
              {sale
                ? "Venta generada"
                : ["rechazada", "vencida", "anulada"].includes(quote.data.estado)
                  ? quote.data.estado
                  : "Pendiente de venta"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cliente: {quote.data.clienteNombre ?? "Sin cliente"} | Emision:{" "}
              {quote.data.fechaEmision} | Vence:{" "}
              {quote.data.fechaVencimiento ?? "No definido"}
            </p>
          </div>
          {sale ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={`/ventas/${sale.id}`}
            >
              Ver venta
            </Link>
          ) : null}
        </div>
      </div>

      <QuoteSummaryCard quote={quote.data} />

      <div className="rounded-lg border bg-background p-5">
        <p className="font-semibold">Siguiente paso</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {sale
            ? "Esta cotizacion ya fue convertida en venta."
            : "Confirma la venta para crear una orden de venta y congelar cliente, items y total."}
        </p>
      </div>

      <QuoteSalePanel
        canConfirmSale={canConfirmSale}
        itemsCount={itemRows.length}
        quote={quote.data}
        sale={sale}
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
          description="Items manuales o vinculados al catalogo; el precio queda historico en la cotizacion."
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
          items={itemRows}
          quote={quote.data}
        />
      </section>

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        PDF y envio se implementaran en una fase posterior.
      </div>
    </section>
  );
}
