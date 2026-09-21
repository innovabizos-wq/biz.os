import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { CustomerAnalyticsCharts } from "@/modules/crm/components/customer-analytics-charts";
import { CustomersDatabase } from "@/modules/crm/components/customers-database";
import {
  brainRuntime,
  type CrmCustomerSearchOutput,
} from "@/modules/brain/runtime";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type CrmCustomersPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function CrmCustomersPage({
  searchParams,
}: CrmCustomersPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canView =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasAnyPermission(access.tenant.permissions, [
      "crm.customers.view",
      "crm.customers.create",
      "crm.customers.edit",
    ]);
  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="CRM"
          title="Clientes"
        />
        <EmptyState
          description="Tu rol no tiene permisos para clientes CRM."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const customers = await brainRuntime.invoke<CrmCustomerSearchOutput>({
    input: { limit: 5000, query: "" },
    skillId: "crm.customer.search",
    source: {
      channel: "module",
      module: "crm",
      surface: "crm.customers.database",
    },
    tenant: access.tenant,
  });
  const customerRows = customers.ok ? customers.data.data.customers : [];

  return (
    <section className="relative flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        title="Base de datos"
        titleClassName="app-page-title-compact normal-case"
      />

      <EphemeralPageAlert error={params?.error} />

      <div className="-mt-2" data-crm-charts-region>
        <CustomerAnalyticsCharts customers={customerRows} />
      </div>

      {customers.ok && customerRows.length > 0 ? (
        <CustomersDatabase customers={customerRows} />
      ) : (
        <EmptyState
          description="Aun no hay clientes o prospectos visibles."
          title="Sin clientes"
        />
      )}
    </section>
  );
}
