import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { AgendaFilters } from "@/modules/agenda/components/agenda-filters";
import { FollowupsTable } from "@/modules/agenda/components/followups-table";
import {
  getAgendaFollowups,
  getAssignableUsersForAgenda,
  parseAgendaSearchParams,
} from "@/modules/agenda/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type AgendaFollowupsPageProps = {
  searchParams?: Promise<{
    error?: string;
    estado?: string;
    range?: string;
    scope?: string;
  }>;
};

function getReturnTo(scope: string, estado: string, range: string) {
  const params = new URLSearchParams({ estado, range, scope });

  return `/agenda/seguimientos?${params.toString()}`;
}

export default async function AgendaFollowupsPage({
  searchParams,
}: AgendaFollowupsPageProps) {
  const params = await searchParams;
  const access = await requireAdminAccess();
  const canViewAgenda =
    isModuleActive(access.tenant.activeModules, "crm") &&
    hasPermission(access.tenant.permissions, "crm.followups.view");
  const canEditAgenda =
    canViewAgenda && hasPermission(access.tenant.permissions, "crm.followups.edit");
  const { filters, range } = parseAgendaSearchParams(params ?? {});
  const returnTo = getReturnTo(filters.scope, filters.estado, range);

  if (!canViewAgenda) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta sección."
          eyebrow="Operación"
          title="Seguimientos"
        />
        <EmptyState
          description="Solicita acceso al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [followups, assignableUsers] = await Promise.all([
    getAgendaFollowups(access.tenant, filters),
    getAssignableUsersForAgenda(access.tenant),
  ]);

  return (
    <section className="space-y-6 rounded-[2rem] bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-4 md:p-6">
      <div className="rounded-3xl border border-sky-100 bg-white/85 p-6 shadow-sm backdrop-blur">
        <SectionHeader
          description="Lista operativa para completar, cancelar, reabrir o reasignar seguimientos CRM."
          eyebrow="Operación"
          title="Seguimientos"
        />
      </div>

      <EphemeralPageAlert error={params?.error} />

      <div className="rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm">
        <AgendaFilters estado={filters.estado} range={range} scope={filters.scope} />
      </div>

      {!followups.ok ? (
        <EmptyState
          description={followups.error.message}
          title="No se pudo cargar la agenda"
        />
      ) : followups.data.length > 0 ? (
        <FollowupsTable
          assignableUsers={assignableUsers.ok ? assignableUsers.data : []}
          canEdit={canEditAgenda}
          followups={followups.data}
          returnTo={returnTo}
        />
      ) : (
        <EmptyState
          description="No hay seguimientos para los filtros seleccionados."
          title="Sin seguimientos"
        />
      )}
    </section>
  );
}
