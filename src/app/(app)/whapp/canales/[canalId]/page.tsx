import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { InboxChannelDetailCard } from "@/modules/inbox/components/inbox-channel-detail-card";
import { InboxMetaOperationalHealth } from "@/modules/inbox/components/inbox-meta-operational-health";
import { InboxWebhookEventsPanel } from "@/modules/inbox/components/inbox-webhook-events-panel";
import { INBOX_CHANNEL_LABELS } from "@/modules/inbox/constants";
import {
  getInboxChannelDetail,
  getInboxChannelMetaStatus,
  getInboxMetaChannelDiagnostic,
  getInboxUnassociatedWebhookEventsForChannel,
  getInboxWebhookEventsForChannel,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type WhappChannelDetailPageProps = {
  params: Promise<{ canalId: string }>;
};

export default async function WhappChannelDetailPage({
  params,
}: WhappChannelDetailPageProps) {
  const [{ canalId }, access] = await Promise.all([params, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver salud del canal."
          eyebrow="Whapp"
          title="Salud del canal"
        />
        <EmptyState
          description="Solicita permisos de canales al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [channel, metaStatus, webhookEvents, unassociatedWebhookEvents, diagnostic] =
    await Promise.all([
      getInboxChannelDetail(canalId),
      getInboxChannelMetaStatus(canalId),
      getInboxWebhookEventsForChannel(canalId),
      getInboxUnassociatedWebhookEventsForChannel(canalId),
      getInboxMetaChannelDiagnostic(canalId),
    ]);

  if (!channel.ok || !channel.data) {
    notFound();
  }

  const associatedEvents = webhookEvents.ok ? webhookEvents.data : [];
  const unassociatedEvents = unassociatedWebhookEvents.ok
    ? unassociatedWebhookEvents.data
    : [];
  const hasStatuses = associatedEvents.some((event) => event.eventType === "status");
  const hasMessages = associatedEvents.some((event) => event.eventType === "message");

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description={`${INBOX_CHANNEL_LABELS[channel.data.canal]} - ${channel.data.proveedor}`}
          eyebrow="Whapp"
          title="Salud del canal"
        />
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants({ variant: "outline" })} href="/whapp/canales">
            Canales
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/inbox/canales/${channel.data.id}`}
          >
            Configuracion Inbox
          </Link>
        </div>
      </div>

      <InboxMetaOperationalHealth
        channel={channel.data}
        metaStatus={metaStatus.ok ? metaStatus.data : null}
        unassociatedEvents={unassociatedEvents}
        webhookEvents={associatedEvents}
      />

      {!associatedEvents.length ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          Meta todavia no ha enviado eventos a este endpoint para este canal.
        </div>
      ) : null}

      {unassociatedEvents.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          El phone_number_id recibido no coincide con el canal configurado, o el
          evento llego con error de asociacion. Revisa phone_number_id y WABA.
        </div>
      ) : null}

      {hasStatuses && !hasMessages ? (
        <div className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Meta esta enviando estados, pero aun no mensajes entrantes.
        </div>
      ) : null}

      {diagnostic.ok && diagnostic.data.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Advertencias operativas</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {diagnostic.data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <InboxChannelDetailCard
        channel={channel.data}
        metaStatus={metaStatus.ok ? metaStatus.data : null}
      />

      <InboxWebhookEventsPanel
        emptyMessage="Todavia no se han recibido eventos webhook asociados a este canal."
        events={associatedEvents}
        title="Eventos webhook asociados"
      />
      <InboxWebhookEventsPanel
        description="Eventos Meta recientes con error o sin canal asociado visible para este tenant."
        emptyMessage="No hay eventos Meta no asociados ni eventos con error visibles."
        events={unassociatedEvents}
        title="Eventos webhook no asociados"
      />
    </section>
  );
}
