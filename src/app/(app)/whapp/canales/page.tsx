import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getInboxChannels } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappChannelList } from "@/modules/whapp/components/whapp-channel-list";

export default async function WhappChannelsPage() {
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
          description="No tienes permiso para ver canales WhatsApp."
          eyebrow="Whapp"
          title="Canales WhatsApp"
        />
        <EmptyState
          description="Solicita permisos de canales al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const channels = await getInboxChannels();
  const rows = channels.ok
    ? channels.data.filter((channel) => channel.canal === "whatsapp")
    : [];
  const active = rows.filter((channel) => channel.estado === "activo").length;
  const inactive = rows.filter((channel) => channel.estado === "inactivo").length;
  const pending = rows.filter((channel) => channel.estado === "pendiente").length;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Canales WhatsApp Meta y manuales reutilizados desde Inbox, con advertencias de duplicados operativos."
          eyebrow="Whapp"
          title="Canales WhatsApp"
        />
        {canManage ? (
          <Link className={buttonVariants()} href="/inbox/canales/nuevo?tipo=meta">
            Crear canal Meta
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Activos</p>
          <p className="mt-2 text-2xl font-semibold">{active}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Inactivos</p>
          <p className="mt-2 text-2xl font-semibold">{inactive}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Pendientes/error</p>
          <p className="mt-2 text-2xl font-semibold">
            {pending + rows.filter((channel) => channel.estado === "error").length}
          </p>
        </div>
      </div>

      {channels.ok && rows.length > 0 ? (
        <WhappChannelList channels={rows} />
      ) : (
        <EmptyState
          description={
            channels.ok
              ? "No hay canales WhatsApp configurados."
              : channels.error.message
          }
          title="Sin canales WhatsApp"
        />
      )}
    </section>
  );
}
