import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { CustomerAnalyticsCharts } from "@/modules/crm/components/customer-analytics-charts";
import { CustomersDatabase } from "@/modules/crm/components/customers-database";
import { getCrmCustomers } from "@/modules/crm/queries";
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
  const canCreate = hasPermission(access.tenant.permissions, "crm.customers.create");

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

  const customers = await getCrmCustomers(access.tenant);
  const customerRows = customers.ok ? customers.data : [];

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-6 overflow-hidden">
      <SectionHeader
        actions={
          canCreate ? (
            <Link className={buttonVariants()} href="/crm/clientes/nuevo">
              Nuevo cliente/prospecto
            </Link>
          ) : null
        }
        title="Base de datos"
        titleClassName="app-page-title-compact normal-case"
      />

      <EphemeralPageAlert error={params?.error} />

      <CustomerAnalyticsCharts customers={customerRows} />

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
