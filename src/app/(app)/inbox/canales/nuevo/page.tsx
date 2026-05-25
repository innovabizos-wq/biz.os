import { EmptyState } from "@/components/shared/empty-state";
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

      {params?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {params.error}
        </p>
      ) : null}

      <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
        Los access tokens, app secrets y verify tokens se registran despues en el
        detalle del canal. No se reciben ni envian mensajes reales en esta fase.
      </div>

      {type === "manual" ? (
        <InboxChannelForm canManage={canManage} />
      ) : (
        <InboxMetaChannelForm mode="create" />
      )}
    </section>
  );
}
