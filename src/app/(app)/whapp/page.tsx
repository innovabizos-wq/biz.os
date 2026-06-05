import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { WhappChannelList } from "@/modules/whapp/components/whapp-channel-list";
import {
  getInboxChannels,
  getInboxConversations,
  getInboxSummary,
} from "@/modules/inbox/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function WhappPage() {
  const access = await requireAdminAccess();
  const canView = hasAnyPermission(access.tenant.permissions, [
    "inbox.conversations.view",
    "inbox.conversations.reply",
    "inbox.channels.view",
    "inbox.channels.manage",
  ]);

  if (!canView) {
    return (
      <section className="space-y-6">
        <SectionHeader
          description="No tienes permiso para ver el centro operativo WhatsApp."
          eyebrow="Whapp"
          title="Whapp"
        />
        <EmptyState
          description="Solicita permisos de Inbox o canales al administrador."
          title="Acceso denegado"
        />
      </section>
    );
  }

  const [summary, channels, conversations] = await Promise.all([
    getInboxSummary(),
    getInboxChannels(),
    getInboxConversations(),
  ]);
  const recent = conversations.ok ? conversations.data.slice(0, 5) : [];
  const whatsappChannels = channels.ok
    ? channels.data.filter((channel) => channel.canal === "whatsapp")
    : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Centro operativo para conversaciones, canal Meta, salud y acciones comerciales desde WhatsApp."
          eyebrow="Whapp"
          title="Whapp"
        />
        <div className="flex flex-wrap gap-2">
          <Link className={buttonVariants()} href="/whapp/conversaciones">
            Conversaciones
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/whapp/canales">
            Canales
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Conversaciones abiertas</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.openConversations : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Sin asignar/pendientes</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.pendingConversations : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Canales activos</p>
          <p className="mt-2 text-2xl font-semibold">
            {summary.ok ? summary.data.activeChannels : 0}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">WhatsApp Meta</p>
          <p className="mt-2 text-2xl font-semibold">{whatsappChannels.length}</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Regla 24h pendiente de control estricto. En futuras fases se bloqueara
        texto libre fuera de ventana y se agregara selector de plantillas Meta.
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-lg border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Actividad reciente</p>
            <Link className="text-sm font-medium" href="/whapp/conversaciones">
              Ver bandeja
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {recent.map((conversation) => (
              <Link
                className="block rounded-md border p-3 hover:bg-muted"
                href={`/whapp/conversaciones/${conversation.id}`}
                key={conversation.id}
              >
                <p className="font-medium">
                  {conversation.contactoNombre ??
                    conversation.contactoTelefono ??
                    "Contacto WhatsApp"}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {conversation.ultimoMensaje ?? "Sin mensajes"}
                </p>
              </Link>
            ))}
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay conversaciones recientes.
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-background p-5">
            <p className="font-semibold">Alcance fase 1</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Recepcion real, envio manual, conversaciones, estados de mensaje,
              notas, asignacion, vinculo CRM y salud de canal. Campanas,
              automatizaciones, plantillas e IA quedan fuera de esta fase.
            </p>
          </div>
          {whatsappChannels.length > 0 ? (
            <WhappChannelList channels={whatsappChannels.slice(0, 3)} />
          ) : (
            <EmptyState
              description="Configura un canal WhatsApp Meta desde Canales."
              title="Sin canales WhatsApp"
            />
          )}
        </div>
      </div>
    </section>
  );
}
