import {
  addInboxMessageAction,
  sendMetaMessageAction,
} from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";
import type { InboxChannel } from "@/modules/inbox/types";

type InboxReplyFormProps = {
  canReply: boolean;
  channel: InboxChannel;
  conversacionId: string;
  isMetaChannel: boolean;
  realMetaReady: boolean;
  realMetaReason?: string | null;
  redirectTo?: string;
};

const CHANNEL_LABELS: Partial<Record<InboxChannel, string>> = {
  facebook: "Facebook Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

export function InboxReplyForm({
  canReply,
  channel,
  conversacionId,
  isMetaChannel,
  realMetaReady,
  realMetaReason,
  redirectTo,
}: InboxReplyFormProps) {
  if (!canReply) return null;

  const channelLabel = CHANNEL_LABELS[channel] ?? "el inbox";
  const canSubmit = !isMetaChannel || realMetaReady;

  return (
    <form
      action={isMetaChannel ? sendMetaMessageAction : addInboxMessageAction}
      className="rounded-lg border bg-background p-4"
    >
      <input name="conversacionId" type="hidden" value={conversacionId} />
      <input name="direccion" type="hidden" value="saliente" />
      {redirectTo ? (
        <input name="redirectTo" type="hidden" value={redirectTo} />
      ) : null}
      <label className="space-y-1 text-sm">
        <span className="font-medium">
          {isMetaChannel ? `Enviar por ${channelLabel}` : "Registrar respuesta manual"}
        </span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
          disabled={!canSubmit}
          name="contenido"
          required
        />
      </label>
      {isMetaChannel && !realMetaReady && realMetaReason ? (
        <p className="mt-2 text-xs text-destructive">
          {realMetaReason}
        </p>
      ) : null}
      {isMetaChannel && realMetaReady ? (
        <p className="mt-2 text-xs text-emerald-700">
          Cumplimiento Meta: envio real habilitado dentro de la ventana de
          respuesta de 24 horas.
        </p>
      ) : null}
      <Button className="mt-3" disabled={!canSubmit} type="submit">
        {isMetaChannel ? `Enviar por ${channelLabel}` : "Registrar respuesta"}
      </Button>
    </form>
  );
}
