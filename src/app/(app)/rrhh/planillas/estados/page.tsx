import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { getCurrentTenantContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { TimesheetStateConfigTable } from "@/modules/hr-timesheets/components/timesheet-state-config-table";
import { getTimesheetStateConfig } from "@/modules/hr-timesheets/queries";

export default async function TimesheetStatesPage() {
  const tenantResult = await getCurrentTenantContext();

  if (!tenantResult.ok) {
    redirect("/login");
  }

  if (!tenantResult.data) {
    redirect("/onboarding");
  }

  if (
    !hasPermission(tenantResult.data.permissions, "hr.timesheets.states.manage")
  ) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="Solicita acceso al administrador de tu empresa."
          eyebrow="RRHH / Planillas"
          title="Estados de planilla"
        />
        <EmptyState
          description="No tienes permisos para configurar estados laborales."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const states = await getTimesheetStateConfig();

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Activa, desactiva y crea estados laborales que alimentan planillas."
        eyebrow="RRHH / Planillas"
        title="Estados de planilla"
      />

      <TimesheetStateConfigTable states={states.ok ? states.data : []} />
    </section>
  );
}
