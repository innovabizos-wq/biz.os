import {
  createMetaChannelAction,
  updateMetaChannelConfigAction,
} from "@/modules/inbox/actions";
import {
  INBOX_CHANNEL_LABELS,
  INBOX_CONNECTION_STATUSES,
  INBOX_META_CHANNELS,
} from "@/modules/inbox/constants";
import type { InboxChannelConfig, InboxMetaChannel } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxMetaChannelFormProps = {
  channel?: InboxChannelConfig;
  mode: "create" | "update";
};

function getConfigText(channel: InboxChannelConfig | undefined, key: string) {
  const value = channel?.configuracionPublica[key];
  return typeof value === "string" ? value : "";
}

function getChannelValue(channel: InboxChannelConfig | undefined): InboxMetaChannel {
  return channel?.canal === "facebook" ||
    channel?.canal === "instagram" ||
    channel?.canal === "whatsapp"
    ? channel.canal
    : "whatsapp";
}

export function InboxMetaChannelForm({
  channel,
  mode,
}: InboxMetaChannelFormProps) {
  const action =
    mode === "create" ? createMetaChannelAction : updateMetaChannelConfigAction;
  const selectedChannel = getChannelValue(channel);

  return (
    <form action={action} className="rounded-lg border bg-background p-5">
      {channel ? <input name="canalId" type="hidden" value={channel.id} /> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Canal Meta</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={selectedChannel}
            disabled={mode === "update"}
            name="canal"
          >
            {INBOX_META_CHANNELS.map((item) => (
              <option key={item} value={item}>
                {INBOX_CHANNEL_LABELS[item]}
              </option>
            ))}
          </select>
          {mode === "update" ? (
            <input name="canal" type="hidden" value={selectedChannel} />
          ) : null}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nombre visible</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={channel?.nombre ?? ""}
            name="nombre"
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Identificador externo</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={channel?.identificadorExterno ?? ""}
            name="identificadorExterno"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">phone_number_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "phone_number_id")}
            name="phoneNumberId"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">waba_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "waba_id")}
            name="wabaId"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">page_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "page_id")}
            name="pageId"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">instagram_business_account_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "instagram_business_account_id")}
            name="instagramBusinessAccountId"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">business_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "business_id")}
            name="businessId"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">app_id</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            defaultValue={getConfigText(channel, "app_id")}
            name="appId"
          />
        </label>
      </div>

      {mode === "update" ? (
        <label className="mt-4 block space-y-1 text-sm">
          <span className="font-medium">Estado de conexion</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 md:w-64"
            defaultValue={channel?.conexionEstado ?? "pendiente"}
            name="conexionEstado"
          >
            {INBOX_CONNECTION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Button className="mt-4" type="submit">
        {mode === "create" ? "Crear canal Meta" : "Guardar configuracion"}
      </Button>
    </form>
  );
}
