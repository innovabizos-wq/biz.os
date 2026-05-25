import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { CustomerForm } from "@/modules/crm/components/customer-form";
import { getAssignableUsersForCrm } from "@/modules/crm/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewCustomerPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function NewCustomerPage({
  searchParams,
}: NewCustomerPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canCreate =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasPermission(access.tenant.permissions, "crm.customers.create");

  if (!canCreate) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para crear clientes."
          eyebrow="CRM"
          title="Nuevo cliente"
        />
        <EmptyState
          description="Tu rol no puede crear clientes CRM."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const assignableUsers = await getAssignableUsersForCrm(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea un cliente o prospecto dentro de la empresa actual."
        eyebrow="CRM"
        title="Nuevo cliente/prospecto"
      />
      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}
      <CustomerForm
        assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
        mode="create"
      />
    </section>
  );
}
