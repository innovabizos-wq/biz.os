import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import type { InboxConversation } from "@/modules/inbox/types";
import { getInboxConversations } from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappConversationFilters } from "@/modules/whapp/components/whapp-conversation-filters";
import { WhappConversationsTable } from "@/modules/whapp/components/whapp-conversations-table";

type WhappConversationsPageProps = {
  searchParams?: Promise<{ q?: string; vista?: string }>;
};

const VALID_FILTERS = new Set([
  "mios",
  "sin_asignar",
  "todos",
  "no_leidos",
  "abiertas",
  "cerradas",
]);

function normalizeFilter(value: string | undefined) {
  return value && VALID_FILTERS.has(value) ? value : "todos";
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
    return [];
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
  const query = params?.q?.trim() ?? "";
  const conversations = await getInboxConversations();
  const rows = conversations.ok
    ? applyFilter(conversations.data, filter, access.profile.id).filter((conversation) =>
        includesQuery(conversation, query),
      )
    : [];

  return (
    <section className="space-y-6">
      <SectionHeader
        description="Bandeja operativa WhatsApp con asignacion, estados, cliente vinculado y ultimo mensaje."
        eyebrow="Whapp"
        title="Conversaciones"
      />

      <WhappConversationFilters activeFilter={filter} query={query} />

      {filter === "no_leidos" ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          El contador de no leidos queda preparado visualmente. Se activara cuando
          el esquema incluya marca de lectura por agente.
        </div>
      ) : null}

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
