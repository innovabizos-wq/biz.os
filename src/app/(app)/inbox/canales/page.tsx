import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InboxChannelsTable } from "@/modules/inbox/components/inbox-channels-table";
import { getInboxChannels } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InboxChannelsPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function InboxChannelsPage({
  searchParams,
}: InboxChannelsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
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
          title="Canales"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const channels = await getInboxChannels();
  const rows = channels.ok ? channels.data : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Gestiona canales manuales y configuraciones oficiales Meta para recepcion webhook y envio real condicionado."
          eyebrow="Inbox"
          title="Canales"
        />
        {canManage ? (
          <div className="flex gap-2">
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/inbox/canales/nuevo?tipo=manual"
            >
              Crear canal manual
            </Link>
            <Link className={buttonVariants()} href="/inbox/canales/nuevo?tipo=meta">
              Crear canal Meta
            </Link>
          </div>
        ) : null}
      </div>

      <EphemeralPageAlert error={params?.error} />

      {channels.ok && rows.length > 0 ? (
        <InboxChannelsTable canManage={canManage} channels={rows} />
      ) : (
        <EmptyState
          description={
            channels.ok
              ? "Crea un canal manual o configura un canal Meta oficial."
              : channels.error.message
          }
          title="Sin canales"
        />
      )}
    </section>
  );
}
