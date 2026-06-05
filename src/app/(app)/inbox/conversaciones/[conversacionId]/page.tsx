import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { InboxAssignmentForm } from "@/modules/inbox/components/inbox-assignment-form";
import { InboxCustomerLinkForm } from "@/modules/inbox/components/inbox-customer-link-form";
import { InboxIncomingMessageForm } from "@/modules/inbox/components/inbox-incoming-message-form";
import { InboxInternalNoteForm } from "@/modules/inbox/components/inbox-internal-note-form";
import { InboxMessageThread } from "@/modules/inbox/components/inbox-message-thread";
import { InboxReplyForm } from "@/modules/inbox/components/inbox-reply-form";
import { InboxStatusActions } from "@/modules/inbox/components/inbox-status-actions";
import { INBOX_CHANNEL_LABELS, INBOX_STATUS_LABELS } from "@/modules/inbox/constants";
import {
  getAssignableUsersForInbox,
  getCustomersForInbox,
  getInboxConversationDetail,
  getInboxConversationMetaSendStatus,
  getInboxEvents,
  getInboxMessages,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type InboxConversationDetailPageProps = {
  params: Promise<{ conversacionId: string }>;
  searchParams?: Promise<{ error?: string }>;
};

export default async function InboxConversationDetailPage({
  params,
  searchParams,
}: InboxConversationDetailPageProps) {
  const [{ conversacionId }, query, access] = await Promise.all([
    params,
    searchParams,
    requireAdminAccess(),
  ]);
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.conversations.assign",
  ]);
  const canReply = hasPermission(
    access.tenant.permissions,
    "inbox.conversations.reply",
  );
  const canCreate = hasPermission(
    access.tenant.permissions,
    "inbox.conversations.create",
  );
  const canAssign = hasPermission(
    access.tenant.permissions,
    "inbox.conversations.assign",
  );
  const canChangeStatus = hasPermission(
    access.tenant.permissions,
    "inbox.conversations.status.change",
  );

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver esta conversacion."
          eyebrow="Inbox"
          title="Conversacion"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [conversation, messages, events, users, customers] = await Promise.all([
    getInboxConversationDetail(conversacionId),
    getInboxMessages(conversacionId),
    getInboxEvents(conversacionId),
    getAssignableUsersForInbox(),
    getCustomersForInbox(),
  ]);

  if (!conversation.ok || !conversation.data) {
    notFound();
  }

  const metaSendStatus = await getInboxConversationMetaSendStatus(
    conversation.data,
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description={`${INBOX_CHANNEL_LABELS[conversation.data.canal]} · ${
            conversation.data.clienteNombre ?? "Sin cliente vinculado"
          }`}
          eyebrow="Inbox"
          title={
            conversation.data.contactoNombre ??
            conversation.data.contactoUsuario ??
            conversation.data.contactoTelefono ??
            "Conversacion"
          }
        />
        <InboxStatusActions
          canChangeStatus={canChangeStatus}
          conversation={conversation.data}
        />
      </div>

      {query?.error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {query.error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <InboxMessageThread messages={messages.ok ? messages.data : []} />
          <div className="grid gap-4 lg:grid-cols-3">
            <InboxReplyForm
              canReply={canReply}
              conversacionId={conversation.data.id}
              realWhatsAppReady={
                metaSendStatus.ok ? metaSendStatus.data.isReady : false
              }
              realWhatsAppReason={
                metaSendStatus.ok ? metaSendStatus.data.reason : null
              }
            />
            <InboxInternalNoteForm
              canReply={canReply}
              conversacionId={conversation.data.id}
            />
            <InboxIncomingMessageForm
              canAddIncoming={canCreate || canReply}
              conversacionId={conversation.data.id}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Detalle</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd>{INBOX_STATUS_LABELS[conversation.data.estado]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Asignado</dt>
                <dd>{conversation.data.asignadoNombre ?? "Sin asignar"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefono</dt>
                <dd>{conversation.data.contactoTelefono ?? "No registrado"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Usuario</dt>
                <dd>{conversation.data.contactoUsuario ?? "No registrado"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Identificador</dt>
                <dd>
                  {conversation.data.contactoIdentificador ?? "No registrado"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 rounded-lg border bg-background p-5">
            <InboxAssignmentForm
              canAssign={canAssign}
              conversation={conversation.data}
              users={users.ok ? users.data : []}
            />
            <InboxCustomerLinkForm
              canAssign={canAssign}
              conversation={conversation.data}
              customers={customers.ok ? customers.data : []}
            />
          </div>

          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Eventos</p>
            <div className="mt-3 space-y-3 text-sm">
              {(events.ok ? events.data : []).slice(0, 8).map((event) => (
                <div className="border-l pl-3" key={event.id}>
                  <p className="font-medium">{event.tipo}</p>
                  <p className="text-muted-foreground">
                    {event.descripcion ?? "Evento registrado."}
                  </p>
                </div>
              ))}
              {events.ok && events.data.length === 0 ? (
                <p className="text-muted-foreground">Sin eventos visibles.</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
