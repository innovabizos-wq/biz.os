import type {
  InboxChannelConfig,
  InboxMetaChannelStatus,
  InboxWebhookEvent,
} from "@/modules/inbox/types";

type InboxMetaOperationalHealthProps = {
  channel: InboxChannelConfig;
  metaStatus: InboxMetaChannelStatus | null;
  unassociatedEvents: InboxWebhookEvent[];
  webhookEvents: InboxWebhookEvent[];
};

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatDateTime(value: string | null) {
  if (!value) return "Sin registro";

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
        ok ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
      }`}
    >
      {text}
    </span>
  );
}

export function InboxMetaOperationalHealth({
  channel,
  metaStatus,
  unassociatedEvents,
  webhookEvents,
}: InboxMetaOperationalHealthProps) {
  const phoneNumberId = getString(channel.configuracionPublica.phone_number_id);
  const wabaId = getString(channel.configuracionPublica.waba_id);
  const publicConfigComplete =
    channel.canal === "whatsapp"
      ? Boolean(phoneNumberId && wabaId)
      : Boolean(channel.identificadorExterno);
  const secretsComplete = Boolean(
    metaStatus?.tieneAccessToken &&
      metaStatus.tieneAppSecret &&
      metaStatus.tieneVerifyToken,
  );
  const lastPost = webhookEvents[0] ?? null;
  const lastInboundMessage =
    webhookEvents.find((event) => event.eventType === "message" && event.procesado) ??
    null;
  const lastError =
    [...webhookEvents, ...unassociatedEvents].find((event) => event.error) ?? null;

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Estado operativo</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lectura segura para validar recepcion, asociacion y preparacion de
            envio manual.
          </p>
        </div>
        <StatusPill
          ok={Boolean(lastPost)}
          text={lastPost ? "POST recibido" : "Sin POST"}
        />
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Configuracion publica</dt>
          <dd>
            <StatusPill
              ok={publicConfigComplete}
              text={publicConfigComplete ? "Completa" : "Incompleta"}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Secretos</dt>
          <dd>
            <StatusPill
              ok={secretsComplete}
              text={secretsComplete ? "Completos" : "Incompletos"}
            />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Webhook verificado</dt>
          <dd>
            {metaStatus?.tieneVerifyToken
              ? "Verify token configurado. GET real se confirma en Meta."
              : "No disponible"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ultimo POST recibido</dt>
          <dd>{formatDateTime(lastPost?.receivedAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Ultimo mensaje entrante procesado
          </dt>
          <dd>{formatDateTime(lastInboundMessage?.receivedAt ?? null)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ultimo error webhook</dt>
          <dd className="text-destructive">
            {lastError?.error ?? "Sin errores visibles"}
          </dd>
        </div>
      </dl>

      {!lastPost ? (
        <p className="mt-4 rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          Todavia no hay POST recibido para este canal.
        </p>
      ) : null}
    </div>
  );
}
