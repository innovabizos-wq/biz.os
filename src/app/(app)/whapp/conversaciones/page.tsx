import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { INBOX_CHANNELS } from "@/modules/inbox/constants";
import type { InboxChannel, InboxConversation } from "@/modules/inbox/types";
import { getInboxConversations } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappConversationFilters } from "@/modules/whapp/components/whapp-conversation-filters";
import { WhappConversationsTable } from "@/modules/whapp/components/whapp-conversations-table";

type WhappConversationsPageProps = {
  searchParams?: Promise<{ canal?: string; q?: string; vista?: string }>;
};

const VALID_FILTERS = new Set([
  "mios",
  "sin_asignar",
  "todos",
  "no_leidos",
  "sla_vencido",
  "sla_riesgo",
  "abiertas",
  "cerradas",
]);

function normalizeFilter(value: string | undefined) {
  return value && VALID_FILTERS.has(value) ? value : "todos";
}

function normalizeChannel(value: string | undefined): InboxChannel | "todos" {
  return value && (INBOX_CHANNELS as readonly string[]).includes(value)
    ? (value as InboxChannel)
    : "todos";
}

function includesQuery(conversation: InboxConversation, query: string) {
  if (!query) return true;

  const haystack = [
    conversation.contactoNombre,
    conversation.contactoTelefono,
    conversation.contactoIdentificador,
    conversation.contactoUsuario,
    conversation.clienteNombre,
    conversation.ultimoMensaje,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function applyFilter(
  conversations: InboxConversation[],
  filter: string,
  profileId: string,
) {
  if (filter === "mios") {
    return conversations.filter((conversation) => conversation.asignadoA === profileId);
  }

  if (filter === "sin_asignar") {
    return conversations.filter((conversation) => !conversation.asignadoA);
  }

  if (filter === "abiertas") {
    return conversations.filter((conversation) => conversation.estado !== "cerrada");
  }

  if (filter === "cerradas") {
    return conversations.filter((conversation) => conversation.estado === "cerrada");
  }

  if (filter === "no_leidos") {
    return conversations.filter((conversation) => conversation.unreadCount > 0);
  }

  if (filter === "sla_vencido") {
    return conversations.filter((conversation) => conversation.slaStatus === "vencido");
  }

  if (filter === "sla_riesgo") {
    return conversations.filter((conversation) => conversation.slaStatus === "riesgo");
  }

  return conversations;
}

export default async function WhappConversationsPage({
  searchParams,
}: WhappConversationsPageProps) {
  const [params, access] = await Promise.all([searchParams, requireAdminAccess()]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.conversations.assign",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver conversaciones Whapp."
          eyebrow="Whapp"
          title="Conversaciones"
        />
        <EmptyState
          description="Solicita permisos de conversaciones al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const filter = normalizeFilter(params?.vista);
  const channel = normalizeChannel(params?.canal);
  const query = params?.q?.trim() ?? "";
  const conversations = await getInboxConversations();
  const rows = conversations.ok
    ? applyFilter(conversations.data, filter, access.profile.id)
        .filter((conversation) =>
          channel === "todos" ? true : conversation.canal === channel,
        )
        .filter((conversation) => includesQuery(conversation, query))
    : [];

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Visor omnicanal para WhatsApp, Facebook Messenger, Instagram DM, correo y conversaciones manuales."
        eyebrow="Whapp"
        title="Conversaciones"
      />

      <WhappConversationFilters
        activeChannel={channel}
        activeFilter={filter}
        query={query}
      />

      {conversations.ok && rows.length > 0 ? (
        <WhappConversationsTable conversations={rows} />
      ) : (
        <EmptyState
          description={
            conversations.ok
              ? "No hay conversaciones que coincidan con estos filtros."
              : conversations.error.message
          }
          title="Sin conversaciones"
        />
      )}
    </section>
  );
}
