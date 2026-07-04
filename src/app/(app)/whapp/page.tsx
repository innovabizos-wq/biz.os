import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { SectionHeader } from "@/components/shared/section-header";
import { buttonVariants } from "@/components/ui/button";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { InboxChannelBadge } from "@/modules/inbox/components/inbox-channel-badge";
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
  const omnichannelChannels = channels.ok
    ? channels.data.filter((channel) =>
        ["whatsapp", "facebook", "instagram", "email", "manual"].includes(
          channel.canal,
        ),
      )
    : [];
  const slaBreached = conversations.ok
    ? conversations.data.filter((conversation) => conversation.slaStatus === "vencido")
        .length
    : 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          description="Centro operativo omnicanal para WhatsApp, Facebook Messenger, Instagram DM, correo, CRM y acciones comerciales."
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
          <Link className={buttonVariants({ variant: "outline" })} href="/whapp/plantillas">
            Plantillas
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/whapp/campanas">
            Campanas
          </Link>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/whapp/automatizaciones"
          >
            Automatizaciones
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
          <p className="text-sm text-muted-foreground">SLA vencido</p>
          <p className="mt-2 text-2xl font-semibold">{slaBreached}</p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm text-muted-foreground">Canales omnicanal</p>
          <p className="mt-2 text-2xl font-semibold">
            {omnichannelChannels.length}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Cumplimiento Meta: usa texto libre solo dentro de la ventana operativa de
        24 horas. Para conversaciones fuera de ventana se requiere plantilla
        aprobada antes de enviar.
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
                <div className="flex flex-wrap items-center gap-2">
                  <InboxChannelBadge channel={conversation.canal} showLabel={false} />
                  <p className="font-medium">
                    {conversation.contactoNombre ??
                      conversation.contactoTelefono ??
                      "Contacto omnicanal"}
                  </p>
                  {conversation.unreadCount > 0 ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      {conversation.unreadCount} nuevo
                    </span>
                  ) : null}
                </div>
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
              Visor omnicanal sobre Inbox con identidad por canal, recepcion Meta,
              envio WhatsApp, correo preparado, no leidos por agente, notas,
              asignacion, vinculo CRM y salud de canal. Campanas,
              plantillas, campanas, reglas de autopilot y automatizaciones
              avanzan hacia ejecucion controlada e IA contextual.
            </p>
          </div>
          {omnichannelChannels.length > 0 ? (
            <WhappChannelList channels={omnichannelChannels.slice(0, 3)} />
          ) : (
            <EmptyState
              description="Configura WhatsApp, Facebook, Instagram, correo o un canal manual desde Canales."
              title="Sin canales omnicanal"
            />
          )}
        </div>
      </div>
    </section>
  );
}
