import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { CustomerForm } from "@/modules/crm/components/customer-form";
import { CustomerSummaryCard } from "@/modules/crm/components/customer-summary-card";
import { CustomerTimeline } from "@/modules/crm/components/customer-timeline";
import { FollowupForm } from "@/modules/crm/components/followup-form";
import { FollowupsList } from "@/modules/crm/components/followups-list";
import { InteractionForm } from "@/modules/crm/components/interaction-form";
import { InteractionsList } from "@/modules/crm/components/interactions-list";
import {
  getAssignableUsersForCrm,
  getCrmCustomerDetail,
  getCrmCustomerFollowups,
  getCrmCustomerInteractions,
} from "@/modules/crm/queries";
import { getQuotesForCustomer } from "@/modules/quotes/queries";
import { CustomerQuotesList } from "@/modules/quotes/components/customer-quotes-list";
import { CustomerSalesList } from "@/modules/sales/components/customer-sales-list";
import { getSalesForCustomer } from "@/modules/sales/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type CustomerDetailPageProps = {
  params: Promise<{ clienteId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const [{ clienteId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const crmActive = isModuleActive(access.tenant.activeModules, "crm");
  const canView = crmActive && hasPermission(access.tenant.permissions, "crm.customers.view");
  const canEdit = crmActive && hasPermission(access.tenant.permissions, "crm.customers.edit");
  const canCreateInteraction =
    crmActive && hasPermission(access.tenant.permissions, "crm.interactions.create");
  const canCreateFollowup =
    crmActive && hasPermission(access.tenant.permissions, "crm.followups.create");
  const canEditFollowup =
    crmActive && hasPermission(access.tenant.permissions, "crm.followups.edit");
  const canViewQuotes = hasPermission(access.tenant.permissions, "quotes.view");
  const canCreateQuotes = hasPermission(access.tenant.permissions, "quotes.create");
  const canViewSales = hasPermission(access.tenant.permissions, "sales.orders.view");
  const canViewActivity =
    crmActive &&
    hasAnyPermission(access.tenant.permissions, [
      "crm.interactions.view",
      "crm.interactions.create",
      "crm.followups.view",
      "crm.followups.create",
      "crm.followups.edit",
    ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="CRM"
          title="Cliente"
        />
        <EmptyState
          description="Solicita acceso al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [customer, interactions, followups, assignableUsers, quotes, sales] = await Promise.all([
    getCrmCustomerDetail(access.tenant, clienteId),
    getCrmCustomerInteractions(access.tenant, clienteId),
    getCrmCustomerFollowups(access.tenant, clienteId),
    getAssignableUsersForCrm(access.tenant),
    getQuotesForCustomer(access.tenant, clienteId),
    canViewSales ? getSalesForCustomer(access.tenant, clienteId) : Promise.resolve(null),
  ]);

  if (!customer.ok || !customer.data) {
    notFound();
  }

  const interactionRows = interactions.ok ? interactions.data : [];
  const followupRows = followups.ok ? followups.data : [];
  const quoteRows = quotes.ok ? quotes.data : [];
  const saleRows = sales?.ok ? sales.data : [];
  const lastActivityAt = [
    customer.data.updatedAt,
    ...interactionRows.map((interaction) => interaction.createdAt),
    ...followupRows.map((followup) => followup.completadoAt ?? followup.fechaProgramada),
  ]
    .filter(Boolean)
    .sort((first, second) => second.localeCompare(first))[0];

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Ficha comercial, historial y acciones para avanzar la relacion."
        eyebrow="CRM"
        title={customer.data.nombre}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <CustomerSummaryCard
        actions={
          <>
            {canCreateQuotes ? (
              <Link
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href={`/cotizaciones/nueva?clienteId=${clienteId}`}
              >
                Crear cotizacion
              </Link>
            ) : null}
            {canCreateFollowup ? (
              <a
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href="#seguimientos"
              >
                Agendar seguimiento
              </a>
            ) : null}
            {canCreateInteraction ? (
              <a
                className={buttonVariants({ size: "sm", variant: "outline" })}
                href="#interacciones"
              >
                Registrar interaccion
              </a>
            ) : null}
          </>
        }
        customer={customer.data}
        lastActivityAt={lastActivityAt}
        stats={{
          followups: followupRows.length,
          interactions: interactionRows.length,
          quotes: quoteRows.length,
          sales: saleRows.length,
        }}
      />

      <section className="space-y-4">
        <SectionHeader
          description="Linea de tiempo consolidada con gestiones y seguimientos."
          title="Historial del cliente"
        />
        <CustomerTimeline
          followups={followupRows}
          interactions={interactionRows}
          quotes={quoteRows}
          sales={saleRows}
        />
      </section>

      {canEdit ? (
        <CustomerForm
          assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
          customer={customer.data}
          mode="update"
        />
      ) : null}

      {canViewQuotes || canCreateQuotes ? (
        <section className="space-y-4">
          <SectionHeader
            description="Cotizaciones basicas asociadas a este cliente."
            title="Cotizaciones"
          />
          <CustomerQuotesList
            canCreate={canCreateQuotes}
            clienteId={clienteId}
            quotes={quoteRows}
          />
        </section>
      ) : null}

      {canViewSales ? (
        <section className="space-y-4">
          <SectionHeader
            description="Ventas generadas para este cliente con datos comerciales congelados."
            title="Ventas"
          />
          <CustomerSalesList sales={saleRows} />
        </section>
      ) : null}

      {canViewActivity ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-4" id="interacciones">
            <SectionHeader
              description="Notas, llamadas o mensajes registrados manualmente."
              title="Interacciones"
            />
            {canCreateInteraction ? <InteractionForm clienteId={clienteId} /> : null}
            <InteractionsList interactions={interactionRows} />
          </section>

          <section className="space-y-4" id="seguimientos">
            <SectionHeader
              description="Pendientes comerciales asociados al cliente."
              title="Seguimientos"
            />
            {canCreateFollowup ? (
              <FollowupForm
                assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
                clienteId={clienteId}
              />
            ) : null}
            <FollowupsList
              canEdit={canEditFollowup}
              clienteId={clienteId}
              followups={followupRows}
            />
          </section>
        </div>
      ) : null}
    </section>
  );
}
