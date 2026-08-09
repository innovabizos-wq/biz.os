import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InboxMetaConnectionCenter } from "@/modules/inbox/components/inbox-meta-connection-center";
import { getInboxChannelMetaStatus, getInboxChannels } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function InboxConnectionsPage() {
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver las conexiones."
          eyebrow="Inbox"
          title="Redes y mensajeria"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const channelsResult = await getInboxChannels();
  const channels = channelsResult.ok ? channelsResult.data : [];
  const metaChannels = channels.filter((channel) => channel.proveedor === "meta");
  const statusResults = await Promise.all(
    metaChannels.map(async (channel) => ({
      channelId: channel.id,
      result: await getInboxChannelMetaStatus(channel.id),
    })),
  );
  const statuses = new Map(
    statusResults.map(({ channelId, result }) => [
      channelId,
      result.ok ? result.data : null,
    ]),
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Conecta tus redes para recibir y atender los mensajes desde Inbox."
          eyebrow="Inbox"
          title="Redes y mensajeria"
        />
        <Link className={buttonVariants({ variant: "outline" })} href="/inbox/canales">
          Ver todos los canales
        </Link>
      </div>

      <InboxMetaConnectionCenter
        canManage={canManage}
        channels={channels}
        statuses={statuses}
      />
    </section>
  );
}
