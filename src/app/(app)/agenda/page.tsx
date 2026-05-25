import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { parseAgendaDateParam } from "@/modules/agenda/components/agenda-calendar-utils";
import { WeeklyAgendaView } from "@/modules/agenda/components/weekly-agenda-view";
import { getWeekFollowups } from "@/modules/agenda/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AgendaPageProps = {
  searchParams?: Promise<{ fecha?: string }>;
};

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const selectedDate = parseAgendaDateParam(params?.fecha);
  const access = await requireAdminAccess();
  const canViewAgenda =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasPermission(access.tenant.permissions, "crm.followups.view");

  if (!canViewAgenda) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Operacion"
          title="Agenda"
        />
        <EmptyState
          description="Solicita acceso al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const weekFollowups = await getWeekFollowups(access.tenant, selectedDate);

  if (!weekFollowups.ok) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description={weekFollowups.error.message}
          eyebrow="Operacion"
          title="Agenda"
        />
        <EmptyState
          description="Verifica que la configuracion de agenda este disponible."
          title="Agenda no disponible"
        />
      </section>
    );
  }

  return (
    <section className="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-3 overflow-hidden">
      <SectionHeader
        actions={
          <Link className={buttonVariants()} href="/agenda/seguimientos">
            Gestionar agenda
          </Link>
        }
        title="Planificador"
        titleClassName="app-page-title-compact normal-case"
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <WeeklyAgendaView
          followups={weekFollowups.data}
          selectedDate={selectedDate}
        />
      </div>
    </section>
  );
}
