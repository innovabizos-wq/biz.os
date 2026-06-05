import type { InboxChannelConfig, InboxMetaChannelStatus } from "@/modules/inbox/types";

type InboxMetaConnectionChecklistProps = {
  channel: InboxChannelConfig;
  metaStatus: InboxMetaChannelStatus | null;
};

const requiredPublicFields = {
  facebook: [
    ["page_id", "Page ID"],
    ["app_id", "App ID"],
  ],
  instagram: [
    ["instagram_business_account_id", "Instagram Business Account ID"],
    ["page_id", "Page ID"],
    ["app_id", "App ID"],
  ],
  whatsapp: [
    ["phone_number_id", "Phone Number ID"],
    ["waba_id", "WABA ID"],
    ["app_id", "App ID"],
  ],
} as const;

function hasConfigValue(channel: InboxChannelConfig, key: string) {
  const value = channel.configuracionPublica[key];

  return typeof value === "string" && value.trim().length > 0;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mt-1 size-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
    />
  );
}

export function InboxMetaConnectionChecklist({
  channel,
  metaStatus,
}: InboxMetaConnectionChecklistProps) {
  const channelKey =
    channel.canal === "facebook" ||
    channel.canal === "instagram" ||
    channel.canal === "whatsapp"
      ? channel.canal
      : "whatsapp";
  const publicFields = requiredPublicFields[channelKey];
  const publicReady = publicFields.every(([key]) => hasConfigValue(channel, key));
  const secretsReady = Boolean(
    metaStatus?.tieneAccessToken &&
      metaStatus.tieneAppSecret &&
      metaStatus.tieneVerifyToken,
  );
  const webhookReady = Boolean(channel.webhookUrl ?? "/api/webhooks/meta");
  const ready = publicReady && secretsReady && webhookReady;

  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Preparacion para Meta</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lista corta para que cualquier empresa conecte su canal sin tocar
            codigo.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            ready
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {ready ? "Listo" : "Pendiente"}
        </span>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div className="flex gap-3">
          <StatusDot ok={publicReady} />
          <div>
            <p className="font-medium">Configuracion publica del canal</p>
            <p className="text-muted-foreground">
              Requerido: {publicFields.map(([, label]) => label).join(", ")}.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <StatusDot ok={secretsReady} />
          <div>
            <p className="font-medium">Secretos protegidos</p>
            <p className="text-muted-foreground">
              Access token, app secret y verify token deben estar configurados.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <StatusDot ok={webhookReady} />
          <div>
            <p className="font-medium">Webhook callback</p>
            <p className="text-muted-foreground">
              Usa la URL mostrada en Meta y suscribe el campo messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
