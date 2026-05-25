import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InboxChannelDetailCard } from "@/modules/inbox/components/inbox-channel-detail-card";
import { InboxMetaChannelForm } from "@/modules/inbox/components/inbox-meta-channel-form";
import { InboxMetaSecretsForm } from "@/modules/inbox/components/inbox-meta-secrets-form";
import { InboxVerifyTokenCard } from "@/modules/inbox/components/inbox-verify-token-card";
import { InboxWebhookInstructions } from "@/modules/inbox/components/inbox-webhook-instructions";
import { INBOX_CHANNEL_LABELS } from "@/modules/inbox/constants";
import {
  getInboxChannelDetail,
  getInboxChannelMetaStatus,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InboxChannelDetailPageProps = {
  params: Promise<{ canalId: string }>;
  searchParams?: Promise<{ error?: string; verifyToken?: string }>;
};

function buildWebhookUrl(path: string | null) {
  const webhookPath = path ?? "/api/webhooks/meta";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  return appUrl ? `${appUrl}${webhookPath}` : webhookPath;
}

export default async function InboxChannelDetailPage({
  params,
  searchParams,
}: InboxChannelDetailPageProps) {
  const [{ canalId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver canales."
          eyebrow="Inbox"
          title="Canal"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [channel, metaStatus] = await Promise.all([
    getInboxChannelDetail(canalId),
    getInboxChannelMetaStatus(canalId),
  ]);

  if (!channel.ok || !channel.data) {
    notFound();
  }

  const isMeta = channel.data.proveedor === "meta";

  return (
    <section className="space-y-6">
      <SectionHeader
        description={`${INBOX_CHANNEL_LABELS[channel.data.canal]} · ${channel.data.proveedor}`}
        eyebrow="Inbox"
        title={channel.data.nombre}
      />

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
        Webhook preparado para verificacion y recepcion. El envio de mensajes se
        implementara en la siguiente fase.
      </div>

      <InboxChannelDetailCard
        channel={channel.data}
        metaStatus={metaStatus.ok ? metaStatus.data : null}
      />

      {isMeta ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {canManage ? (
              <InboxMetaChannelForm channel={channel.data} mode="update" />
            ) : null}
            <InboxMetaSecretsForm canalId={channel.data.id} canManage={canManage} />
          </div>
          <div className="space-y-4">
            <InboxWebhookInstructions
              callbackUrl={buildWebhookUrl(channel.data.webhookUrl)}
            />
            <InboxVerifyTokenCard
              canalId={channel.data.id}
              canManage={canManage}
              verifyToken={query?.verifyToken}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-background p-5 text-sm text-muted-foreground">
          Este es un canal manual. La configuracion Meta solo aplica a canales
          con proveedor oficial Meta.
        </div>
      )}
    </section>
  );
}
