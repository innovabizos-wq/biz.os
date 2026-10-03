import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { CustomerSummaryCard } from "@/modules/crm/components/customer-summary-card";
import { CustomerTimeline } from "@/modules/crm/components/customer-timeline";
import { FollowupForm } from "@/modules/crm/components/followup-form";
import { InteractionForm } from "@/modules/crm/components/interaction-form";
import {
  getAssignableUsersForCrm,
  getCrmCustomerDetail,
  getCrmCustomerFollowups,
  getCrmCustomerInteractions,
} from "@/modules/crm/queries";
import { getQuotesForCustomer } from "@/modules/quotes/queries";
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
  const canCreateQuotes = hasPermission(access.tenant.permissions, "quotes.create");
  const canViewSales = hasPermission(access.tenant.permissions, "sales.orders.view");

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
      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <CustomerSummaryCard
        assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
        actions={
          <>
            {canCreateQuotes ? (
              <Link
                className={buttonVariants({
                  className:
                    "h-8 border-white/20 bg-white/10 px-2.5 text-[11px] text-white hover:bg-white/20 hover:text-white",
                  size: "sm",
                  variant: "outline",
                })}
                href={`/cotizaciones/nueva?clienteId=${clienteId}`}
              >
                Cotizar
              </Link>
            ) : null}
            {canCreateFollowup ? (
              <FollowupForm
                assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
                buttonClassName="h-8 border-white/20 bg-white/10 px-2.5 text-[11px] text-white hover:bg-white/20 hover:text-white"
                buttonLabel="Seguimiento"
                clienteId={clienteId}
              />
            ) : null}
            {canCreateInteraction ? (
              <InteractionForm
                buttonClassName="h-8 border-white/20 bg-white/10 px-2.5 text-[11px] text-white hover:bg-white/20 hover:text-white"
                buttonLabel="Interacción"
                clienteId={clienteId}
              />
            ) : null}
          </>
        }
        canEdit={canEdit}
        customer={customer.data}
        lastActivityAt={lastActivityAt}
        stats={{
          followups: followupRows.length,
          interactions: interactionRows.length,
          quotes: quoteRows.length,
          sales: saleRows.length,
        }}
      />

      <section>
        <CustomerTimeline
          followups={followupRows}
          interactions={interactionRows}
          quotes={quoteRows}
          sales={saleRows}
        />
      </section>
    </section>
  );
}
