import { redirect } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { getInboxChannels } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappChannelList } from "@/modules/whapp/components/whapp-channel-list";

export default async function WhappHealthPage() {
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver salud de canales."
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

  const channels = await getInboxChannels();
  const whatsappChannels = channels.ok
    ? channels.data.filter((channel) => channel.canal === "whatsapp")
    : [];

  if (whatsappChannels.length === 1) {
    redirect(`/whapp/canales/${whatsappChannels[0].id}`);
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Selecciona un canal WhatsApp para revisar configuracion, secretos seguros, webhook y eventos."
        eyebrow="Whapp"
        title="Salud del canal"
      />

      {whatsappChannels.length > 0 ? (
        <WhappChannelList channels={whatsappChannels} />
      ) : (
        <EmptyState
          description={
            channels.ok
              ? "No hay canales WhatsApp para diagnosticar."
              : channels.error.message
          }
          title="Sin canales"
        />
      )}
    </section>
  );
}
