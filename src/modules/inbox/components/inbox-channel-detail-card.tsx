import {
  INBOX_CHANNEL_LABELS,
  INBOX_CONNECTION_STATUS_LABELS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig, InboxMetaChannelStatus } from "@/modules/inbox/types";

type InboxChannelDetailCardProps = {
  channel: InboxChannelConfig;
  metaStatus: InboxMetaChannelStatus | null;
};

export function InboxChannelDetailCard({
  channel,
  metaStatus,
}: InboxChannelDetailCardProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="font-semibold">Datos generales</p>
      <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Canal</dt>
          <dd>{INBOX_CHANNEL_LABELS[channel.canal]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Proveedor</dt>
          <dd>{channel.proveedor}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estado</dt>
          <dd>{channel.estado}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Conexion</dt>
          <dd>{INBOX_CONNECTION_STATUS_LABELS[channel.conexionEstado]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Identificador externo</dt>
          <dd>{channel.identificadorExterno ?? "No registrado"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Webhook</dt>
          <dd>{channel.webhookUrl ?? "/api/webhooks/meta"}</dd>
        </div>
      </dl>

      {channel.proveedor === "meta" ? (
        <div className="mt-5 rounded-md border bg-muted p-4 text-sm">
          <p className="font-medium">Estado seguro de secretos</p>
          <dl className="mt-3 grid gap-2 md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Access token</dt>
              <dd>{metaStatus?.tieneAccessToken ? "Configurado" : "No configurado"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">App secret</dt>
              <dd>{metaStatus?.tieneAppSecret ? "Configurado" : "No configurado"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Verify token</dt>
              <dd>{metaStatus?.tieneVerifyToken ? "Configurado" : "No configurado"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Los secretos existen en tabla privada y no se consultan directamente
            desde la UI.
          </p>
        </div>
      ) : null}
    </div>
  );
}
