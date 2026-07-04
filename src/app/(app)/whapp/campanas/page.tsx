import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import {
  getInboxCampaigns,
  getInboxCampaignRecipients,
  getInboxChannels,
  getInboxMetaTemplates,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappCampaignForm } from "@/modules/whapp/components/whapp-campaign-form";
import { WhappCampaignRecipientForm } from "@/modules/whapp/components/whapp-campaign-recipient-form";
import { WhappCampaignRecipientsTable } from "@/modules/whapp/components/whapp-campaign-recipients-table";
import { WhappCampaignsTable } from "@/modules/whapp/components/whapp-campaigns-table";

type WhappCampaignsPageProps = {
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function WhappCampaignsPage({
  searchParams,
}: WhappCampaignsPageProps) {
  const [query, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
    "inbox.conversations.reply",
  ]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver campanas Whapp."
          eyebrow="Whapp"
          title="Campanas"
        />
        <EmptyState
          description="Solicita permisos de canales o conversaciones al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [channels, templates, campaigns, recipients] = await Promise.all([
    getInboxChannels(),
    getInboxMetaTemplates(),
    getInboxCampaigns(),
    getInboxCampaignRecipients(),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Planifica campanas WhatsApp con plantillas Meta aprobadas, audiencia prevista y metricas iniciales."
          eyebrow="Whapp"
          title="Campanas"
        />
        <Link className={buttonVariants({ variant: "outline" })} href="/whapp">
          Volver a Whapp
        </Link>
      </div>

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}
      {query?.success ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {query.success}
        </p>
      ) : null}

      <WhappCampaignForm
        canManage={canManage}
        channels={channels.ok ? channels.data : []}
        templates={templates.ok ? templates.data : []}
      />

      <WhappCampaignRecipientForm
        campaigns={campaigns.ok ? campaigns.data : []}
        canManage={canManage}
      />

      {campaigns.ok && campaigns.data.length > 0 ? (
        <WhappCampaignsTable campaigns={campaigns.data} canManage={canManage} />
      ) : (
        <EmptyState
          description={
            campaigns.ok
              ? "No hay campanas registradas."
              : campaigns.error.message
          }
          title="Sin campanas"
        />
      )}

      {recipients.ok && recipients.data.length > 0 ? (
        <WhappCampaignRecipientsTable
          campaigns={campaigns.ok ? campaigns.data : []}
          canManage={canManage}
          recipients={recipients.data}
        />
      ) : (
        <EmptyState
          description={
            recipients.ok
              ? "No hay destinatarios cargados en la cola."
              : recipients.error.message
          }
          title="Sin audiencia"
        />
      )}
    </section>
  );
}
