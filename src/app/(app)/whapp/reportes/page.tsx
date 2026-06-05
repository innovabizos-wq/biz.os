import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { getInboxSummary } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function WhappReportsPage() {
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.channels.view",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver reportes Whapp."
          eyebrow="Whapp"
          title="Reportes basicos"
        />
        <EmptyState
          description="Solicita permisos al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const summary = await getInboxSummary();

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Indicadores iniciales reutilizados desde Inbox. Productividad por agente y SLA quedan para fase multiagente."
        eyebrow="Whapp"
        title="Reportes basicos"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Abiertas</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.openConversations : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.pendingConversations : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Cerradas</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.recentlyClosedConversations : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Canales activos</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.activeChannels : 0}
          </p>
        </div>
      </div>
    </section>
  );
}
