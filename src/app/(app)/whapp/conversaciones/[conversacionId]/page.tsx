import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { getBusinessContext } from "@/modules/business-context/queries";
import { markInboxConversationReadAction } from "@/modules/inbox/actions";
import { InboxChannelBadge } from "@/modules/inbox/components/inbox-channel-badge";
import { InboxAssignmentForm } from "@/modules/inbox/components/inbox-assignment-form";
import { InboxCustomerLinkForm } from "@/modules/inbox/components/inbox-customer-link-form";
import { InboxInternalNoteForm } from "@/modules/inbox/components/inbox-internal-note-form";
import { InboxReplyForm } from "@/modules/inbox/components/inbox-reply-form";
import { InboxStatusActions } from "@/modules/inbox/components/inbox-status-actions";
import { InboxWhatsAppTemplateForm } from "@/modules/inbox/components/inbox-whatsapp-template-form";
import {
  INBOX_CHANNEL_LABELS,
  INBOX_SLA_STATUS_LABELS,
  INBOX_STATUS_LABELS,
} from "@/modules/inbox/constants";
import {
  getApprovedInboxMetaTemplatesForConversation,
  getAssignableUsersForInbox,
  getCustomersForInbox,
  getInboxAutomationRules,
  getInboxConversationDetail,
  getInboxConversationMetaSendStatus,
  getInboxEvents,
  getInboxMessages,
} from "@/modules/inbox/queries";
import { getQuotesForCustomer } from "@/modules/quotes/queries";
import type { Quote } from "@/modules/quotes/types";
import { getSalesForCustomer } from "@/modules/sales/queries";
import type { Sale } from "@/modules/sales/types";
import { requireAdminAccess } from "@/modules/tenant/admin-access";
import { WhappAutopilotPanel } from "@/modules/whapp/components/whapp-autopilot-panel";
import { WhappCommercialPanel } from "@/modules/whapp/components/whapp-commercial-panel";
import { WhappContextualAiPanel } from "@/modules/whapp/components/whapp-contextual-ai-panel";
import { WhappMessageThread } from "@/modules/whapp/components/whapp-message-thread";

type WhappConversationDetailPageProps = {
  params: Promise<{ conversacionId: string }>;
  searchParams?: Promise<{ error?: string; success?: string }>;
};

export default async function WhappConversationDetailPage({
  params,
  searchParams,
}: WhappConversationDetailPageProps) {
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
          eyebrow="Whapp"
          title="Conversacion"
        />
        <EmptyState
          description="Solicita permisos al administrador de tu empresa."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [conversation, messages, events, users, customers, automations] = await Promise.all([
    getInboxConversationDetail(conversacionId),
    getInboxMessages(conversacionId),
    getInboxEvents(conversacionId),
    getAssignableUsersForInbox(),
    getCustomersForInbox(),
    getInboxAutomationRules(),
  ]);

  if (!conversation.ok || !conversation.data) {
    notFound();
  }

  const redirectTo = `/whapp/conversaciones/${conversation.data.id}`;
  const [metaSendStatus, approvedTemplates, quotes, sales, businessContext] = await Promise.all([
    getInboxConversationMetaSendStatus(conversation.data),
    getApprovedInboxMetaTemplatesForConversation(conversation.data),
    conversation.data.clienteId
      ? getQuotesForCustomer(access.tenant, conversation.data.clienteId)
      : Promise.resolve({ data: [] as Quote[], ok: true }),
    conversation.data.clienteId
      ? getSalesForCustomer(access.tenant, conversation.data.clienteId)
      : Promise.resolve({ data: [] as Sale[], ok: true }),
    getBusinessContext(access.tenant),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description={`${INBOX_CHANNEL_LABELS[conversation.data.canal]} - ${
            conversation.data.clienteNombre ?? "Sin cliente vinculado"
          }`}
          eyebrow="Whapp / Conversaciones"
          title={
            conversation.data.contactoNombre ??
            conversation.data.contactoUsuario ??
            conversation.data.contactoTelefono ??
            "Conversacion"
          }
        />
        <div className="flex flex-wrap gap-2">
          <InboxChannelBadge channel={conversation.data.canal} />
          {conversation.data.unreadCount > 0 ? (
            <form action={markInboxConversationReadAction}>
              <input
                name="conversacionId"
                type="hidden"
                value={conversation.data.id}
              />
              <input name="redirectTo" type="hidden" value={redirectTo} />
              <button
                className={buttonVariants({ variant: "outline" })}
                type="submit"
              >
                Marcar leida ({conversation.data.unreadCount})
              </button>
            </form>
          ) : null}
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/whapp/conversaciones"
          >
            Volver
          </Link>
          <InboxStatusActions
            canChangeStatus={canChangeStatus}
            conversation={conversation.data}
            redirectTo={redirectTo}
          />
        </div>
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

      <div className="grid gap-4 2xl:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="space-y-3 rounded-lg border bg-background p-4">
          <p className="font-semibold">Bandeja</p>
          <Link className="block rounded-md border p-3 text-sm" href="/whapp/conversaciones?vista=mios">
            Mios
          </Link>
          <Link className="block rounded-md border p-3 text-sm" href="/whapp/conversaciones?vista=sin_asignar">
            Sin asignar
          </Link>
          <Link className="block rounded-md border p-3 text-sm" href="/whapp/conversaciones?vista=todos">
            Todos
          </Link>
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Popup flotante: el widget actual de Inbox puede seguir operando
            mientras Whapp consolida la vista completa.
          </div>
        </aside>

        <main className="space-y-4">
          <WhappMessageThread messages={messages.ok ? messages.data : []} />
          <InboxReplyForm
            canReply={canReply}
            conversacionId={conversation.data.id}
            realWhatsAppReady={metaSendStatus.ok ? metaSendStatus.data.isReady : false}
            realWhatsAppReason={metaSendStatus.ok ? metaSendStatus.data.reason : null}
            redirectTo={redirectTo}
          />
          <InboxWhatsAppTemplateForm
            canReply={canReply}
            conversacionId={conversation.data.id}
            realWhatsAppReady={metaSendStatus.ok ? metaSendStatus.data.isReady : false}
            redirectTo={redirectTo}
            templates={approvedTemplates.ok ? approvedTemplates.data : []}
          />
          <InboxInternalNoteForm
            canReply={canReply}
            conversacionId={conversation.data.id}
            redirectTo={redirectTo}
          />
        </main>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Cliente y operacion</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Nombre</dt>
                <dd>{conversation.data.contactoNombre ?? "No registrado"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefono / wa_id</dt>
                <dd className="break-all">
                  {conversation.data.contactoTelefono ??
                    conversation.data.contactoIdentificador ??
                    "No registrado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cliente CRM</dt>
                <dd>{conversation.data.clienteNombre ?? "Sin vincular"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Agente</dt>
                <dd>{conversation.data.asignadoNombre ?? "Sin asignar"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd>{INBOX_STATUS_LABELS[conversation.data.estado]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">SLA</dt>
                <dd>
                  {INBOX_SLA_STATUS_LABELS[conversation.data.slaStatus]}
                  {conversation.data.slaDueAt
                    ? ` - vence ${new Date(
                        conversation.data.slaDueAt,
                      ).toLocaleString("es-CR")}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Etiquetas</dt>
                <dd className="text-muted-foreground">Preparado para fase multiagente.</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4 rounded-lg border bg-background p-5">
            <InboxAssignmentForm
              canAssign={canAssign}
              conversation={conversation.data}
              redirectTo={redirectTo}
              users={users.ok ? users.data : []}
            />
            <InboxCustomerLinkForm
              canAssign={canAssign}
              conversation={conversation.data}
              customers={customers.ok ? customers.data : []}
              redirectTo={redirectTo}
            />
          </div>

          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Acciones rapidas</p>
            <div className="mt-3 grid gap-2">
              <Link className={buttonVariants({ variant: "outline" })} href="/crm/clientes/nuevo">
                Crear cliente
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/agenda/seguimientos">
                Crear seguimiento
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/cotizaciones/nueva">
                Crear cotizacion
              </Link>
              <Link className={buttonVariants({ variant: "outline" })} href="/agenda">
                Agendar
              </Link>
            </div>
          </div>

          <WhappCommercialPanel
            clienteId={conversation.data.clienteId}
            clienteNombre={conversation.data.clienteNombre}
            quotes={quotes.ok ? quotes.data : []}
            sales={sales.ok ? sales.data : []}
          />

          <WhappContextualAiPanel
            businessContext={businessContext.ok ? businessContext.data : null}
            conversation={conversation.data}
            messages={messages.ok ? messages.data : []}
            quotes={quotes.ok ? quotes.data : []}
            sales={sales.ok ? sales.data : []}
          />

          <WhappAutopilotPanel
            automations={automations.ok ? automations.data : []}
            canReply={canReply}
            conversation={conversation.data}
            messages={messages.ok ? messages.data : []}
            redirectTo={redirectTo}
          />

          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Auditoria reciente</p>
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
