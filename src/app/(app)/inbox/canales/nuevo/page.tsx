import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasPermission } from "@/lib/permissions/permission-checks";
import { InboxChannelForm } from "@/modules/inbox/components/inbox-channel-form";
import { InboxMetaChannelForm } from "@/modules/inbox/components/inbox-meta-channel-form";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type NewInboxChannelPageProps = {
  searchParams?: Promise<{ error?: string; tipo?: string }>;
};

export default async function NewInboxChannelPage({
  searchParams,
}: NewInboxChannelPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canManage = hasPermission(access.tenant.permissions, "inbox.channels.manage");
  const type = params?.tipo === "manual" ? "manual" : "meta";

  if (!canManage) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para gestionar canales."
          eyebrow="Inbox"
          title="Nuevo canal"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Crea canales manuales o registra la configuracion publica de un canal oficial Meta."
        eyebrow="Inbox"
        title="Nuevo canal"
      />

      <EphemeralPageAlert error={params?.error} />

      <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
        Los access tokens, app secrets y verify tokens se registran despues en el
        detalle del canal. El webhook puede recibir mensajes entrantes cuando
        Meta quede configurado; el envio real queda disponible cuando el canal
        tenga credenciales completas y conversacion compatible.
      </div>

      {type === "manual" ? (
        <InboxChannelForm canManage={canManage} />
      ) : (
        <InboxMetaChannelForm mode="create" />
      )}
    </section>
  );
}
