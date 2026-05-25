import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { getCrmSummary } from "@/modules/crm/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function CrmPage() {
  const access = await requireAdminAccess();
  const canUseCrm =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasAnyPermission(access.tenant.permissions, [
      "crm.customers.view",
      "crm.customers.create",
      "crm.customers.edit",
      "crm.interactions.view",
      "crm.interactions.create",
      "crm.followups.view",
      "crm.followups.create",
      "crm.followups.edit",
    ]);

  if (!canUseCrm) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="CRM"
          title="Acceso denegado"
        />
        <EmptyState
          description="Solicita acceso al administrador de tu empresa."
          title="CRM no disponible"
        />
      </section>
    );
  }

  const summary = await getCrmSummary(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Clientes, prospectos, interacciones manuales y seguimientos básicos."
        eyebrow="CRM"
        title="CRM básico activo"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-5">
          <p className="text-sm text-muted-foreground">Clientes/prospectos</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary.ok ? summary.data.totalCustomers : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-5">
          <p className="text-sm text-muted-foreground">Seguimientos pendientes</p>
          <p className="mt-2 text-3xl font-semibold">
            {summary.ok ? summary.data.pendingFollowups : 0}
          </p>
        </div>
      </div>

      <Link className={buttonVariants()} href="/crm/clientes">
        Ver clientes
      </Link>
    </section>
  );
}
