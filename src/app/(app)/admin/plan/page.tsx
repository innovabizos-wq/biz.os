import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { CurrentPlanCard } from "@/modules/plans/components/current-plan-card";
import { getCurrentEmpresaPlan } from "@/modules/plans/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function AdminPlanPage() {
  const access = await requireAdminAccess();
  const plan = await getCurrentEmpresaPlan(access.tenant);

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Plan actual de la empresa. Los upgrades se implementaran despues."
        eyebrow="Administración"
        title="Plan"
      />
      {plan.ok && plan.data ? (
        <CurrentPlanCard plan={plan.data} />
      ) : (
        <EmptyState description="No hay plan activo visible." title="Plan" />
      )}
    </section>
  );
}
