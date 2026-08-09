import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { changeInboxChannelStatusAction } from "@/modules/inbox/actions";
import type {
  InboxChannelConfig,
  InboxMetaChannel,
  InboxMetaChannelStatus,
} from "@/modules/inbox/types";

type InboxMetaConnectionCenterProps = {
  canManage: boolean;
  channels: InboxChannelConfig[];
  statuses: Map<string, InboxMetaChannelStatus | null>;
};

type MetaNetwork = {
  channel: InboxMetaChannel;
  description: string;
  name: string;
};

const NETWORKS: MetaNetwork[] = [
  {
    channel: "whatsapp",
    description: "Atiende conversaciones y envia plantillas aprobadas desde Inbox.",
    name: "WhatsApp",
  },
  {
    channel: "facebook",
    description: "Gestiona mensajes recibidos por una Pagina de Facebook.",
    name: "Messenger",
  },
  {
    channel: "instagram",
    description: "Gestiona mensajes de una cuenta profesional de Instagram.",
    name: "Instagram",
  },
];

function hasPublicConfiguration(
  channel: InboxChannelConfig,
  network: InboxMetaChannel,
) {
  if (network === "whatsapp") {
    return Boolean(
      channel.configuracionPublica.phone_number_id &&
        channel.configuracionPublica.waba_id,
    );
  }

  return Boolean(channel.identificadorExterno);
}

function StatusPill({ complete, label }: { complete: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        complete
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {label}
    </span>
  );
}

export function InboxMetaConnectionCenter({
  canManage,
  channels,
  statuses,
}: InboxMetaConnectionCenterProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {NETWORKS.map((network) => {
        const networkChannels = channels.filter(
          (channel) => channel.proveedor === "meta" && channel.canal === network.channel,
        );
        const activeChannel = networkChannels.find(
          (channel) => channel.estado === "activo",
        ) ?? networkChannels[0];
        const secretStatus = activeChannel ? statuses.get(activeChannel.id) : null;
        const hasSecrets = Boolean(
          secretStatus?.tieneAccessToken &&
            secretStatus.tieneAppSecret &&
            secretStatus.tieneVerifyToken,
        );
        const hasPublicConfig = activeChannel
          ? hasPublicConfiguration(activeChannel, network.channel)
          : false;
        const ready = Boolean(
          activeChannel &&
            activeChannel.estado === "activo" &&
            activeChannel.conexionEstado === "configurado" &&
            hasPublicConfig &&
            hasSecrets,
        );
        const needsReconnect = Boolean(
          activeChannel &&
            network.channel !== "whatsapp" &&
            !hasSecrets,
        );

        return (
          <article className="flex flex-col rounded-xl border bg-background p-5" key={network.channel}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{network.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {network.description}
                </p>
              </div>
              <StatusPill complete={ready} label={ready ? "Listo" : activeChannel ? "Pendiente" : "Sin conectar"} />
            </div>

            {activeChannel ? (
              <dl className="mt-5 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Canal</dt>
                  <dd className="font-medium">{activeChannel.nombre}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Datos del activo</dt>
                  <dd><StatusPill complete={hasPublicConfig} label={hasPublicConfig ? "Completos" : "Faltantes"} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Credenciales</dt>
                  <dd><StatusPill complete={hasSecrets} label={hasSecrets ? "Completas" : "Faltantes"} /></dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Webhook</dt>
                  <dd>{activeChannel.webhookUrl ? "Configurado" : "Pendiente"}</dd>
                </div>
              </dl>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
                Aun no hay un canal oficial configurado para esta red.
              </div>
            )}

            {canManage ? (
              <div className="mt-6 grid gap-2">
                <Link
                  className={buttonVariants({ className: "w-full", variant: activeChannel ? "outline" : "default" })}
                  href={
                    needsReconnect
                      ? `/api/meta/connect/${network.channel}`
                      : activeChannel
                      ? `/inbox/canales/${activeChannel.id}`
                      : network.channel === "whatsapp"
                        ? `/inbox/canales/nuevo?tipo=meta&canal=${network.channel}`
                        : `/api/meta/connect/${network.channel}`
                  }
                >
                  {needsReconnect
                    ? `Reconectar ${network.name}`
                    : activeChannel
                      ? "Revisar configuracion"
                      : network.channel === "whatsapp"
                        ? "Preparar WhatsApp"
                        : `Conectar ${network.name}`}
                </Link>
                {activeChannel && network.channel !== "whatsapp" ? (
                  <Link
                    className={buttonVariants({ className: "w-full", variant: "outline" })}
                    href={`/api/meta/connect/${network.channel}`}
                  >
                    Conectar otra Página
                  </Link>
                ) : null}
                {activeChannel ? (
                  <form action={changeInboxChannelStatusAction}>
                    <input name="canalId" type="hidden" value={activeChannel.id} />
                    <input name="estado" type="hidden" value="inactivo" />
                    <input name="returnPath" type="hidden" value="/inbox/conexiones" />
                    <button className={buttonVariants({ className: "w-full", variant: "destructive" })} type="submit">
                      Desconectar
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
