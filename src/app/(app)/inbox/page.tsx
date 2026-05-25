import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { InboxSummaryCard } from "@/modules/inbox/components/inbox-summary-card";
import { getInboxSummary } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function InboxPage() {
  const access = await requireAdminAccess();
  const canAccess = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.channels.view",
  ]);

  if (!canAccess) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta seccion."
          eyebrow="Comunicacion"
          title="Inbox"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const summary = await getInboxSummary();
  const data = summary.ok
    ? summary.data
    : {
        activeChannels: 0,
        openConversations: 0,
        pendingConversations: 0,
        recentlyClosedConversations: 0,
      };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Bandeja unificada para conversaciones simuladas de WhatsApp, Facebook Messenger, Instagram DM y canal manual."
          eyebrow="Comunicacion"
          title="Inbox"
        />
        <div className="flex gap-2">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/inbox/canales"
          >
            Canales
          </Link>
          <Link className={buttonVariants()} href="/inbox/conversaciones">
            Conversaciones
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <InboxSummaryCard
          label="Conversaciones abiertas"
          value={data.openConversations}
        />
        <InboxSummaryCard
          label="Conversaciones pendientes"
          value={data.pendingConversations}
        />
        <InboxSummaryCard
          label="Cerradas recientes"
          value={data.recentlyClosedConversations}
        />
        <InboxSummaryCard label="Canales activos" value={data.activeChannels} />
      </div>

      <div className="rounded-lg border border-dashed bg-background p-5 text-sm text-muted-foreground">
        La conexion oficial con Meta se implementara en la siguiente fase. Esta
        version registra canales y mensajes simulados sin webhooks, tokens ni
        envios reales.
      </div>
    </section>
  );
}
