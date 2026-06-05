import { EmptyState } from "@/components/shared/empty-state";
import { EphemeralPageAlert } from "@/components/shared/ephemeral-page-alert";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InboxConversationForm } from "@/modules/inbox/components/inbox-conversation-form";
import { InboxConversationsTable } from "@/modules/inbox/components/inbox-conversations-table";
import {
  getAssignableUsersForInbox,
  getCustomersForInbox,
  getInboxChannels,
  getInboxConversations,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InboxConversationsPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function InboxConversationsPage({
  searchParams,
}: InboxConversationsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.conversations.assign",
  ]);
  const canCreate = hasPermission(
    access.tenant.permissions,
    "inbox.conversations.create",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver conversaciones."
          eyebrow="Inbox"
          title="Conversaciones"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [conversations, channels, users, customers] = await Promise.all([
    getInboxConversations(),
    getInboxChannels(),
    getAssignableUsersForInbox(),
    getCustomersForInbox(),
  ]);
  const rows = conversations.ok ? conversations.data : [];

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Gestiona conversaciones simuladas, clientes vinculados, estados y asignaciones."
        eyebrow="Inbox"
        title="Conversaciones"
      />

      <EphemeralPageAlert error={params?.error} />

      <InboxConversationForm
        canCreate={canCreate}
        channels={channels.ok ? channels.data : []}
        customers={customers.ok ? customers.data : []}
        users={users.ok ? users.data : []}
      />

      {conversations.ok && rows.length > 0 ? (
        <InboxConversationsTable conversations={rows} />
      ) : (
        <EmptyState
          description={
            conversations.ok
              ? "Crea una conversacion manual para iniciar pruebas."
              : conversations.error.message
          }
          title="Sin conversaciones"
        />
      )}
    </section>
  );
}
