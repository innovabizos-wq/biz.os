import {
  addInboxMessageAction,
  sendWhatsAppMessageAction,
} from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";

type InboxReplyFormProps = {
  canReply: boolean;
  conversacionId: string;
  realWhatsAppReady: boolean;
  realWhatsAppReason?: string | null;
  redirectTo?: string;
};

export function InboxReplyForm({
  canReply,
  conversacionId,
  realWhatsAppReady,
  realWhatsAppReason,
  redirectTo,
}: InboxReplyFormProps) {
  if (!canReply) return null;

  return (
    <form
      action={realWhatsAppReady ? sendWhatsAppMessageAction : addInboxMessageAction}
      className="rounded-lg border bg-background p-4"
    >
      <input name="conversacionId" type="hidden" value={conversacionId} />
      <input name="direccion" type="hidden" value="saliente" />
      {redirectTo ? (
        <input name="redirectTo" type="hidden" value={redirectTo} />
      ) : null}
      <label className="space-y-1 text-sm">
        <span className="font-medium">
          {realWhatsAppReady
            ? "Enviar por WhatsApp"
            : "Respuesta saliente simulada"}
        </span>
        <textarea
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
          name="contenido"
          required
        />
      </label>
      {!realWhatsAppReady && realWhatsAppReason ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {realWhatsAppReason}
        </p>
      ) : null}
      {realWhatsAppReady ? (
        <p className="mt-2 text-xs text-amber-700">
          Regla 24h pendiente de control estricto. En futuras fases se bloqueara
          texto libre fuera de ventana.
        </p>
      ) : null}
      <Button className="mt-3" type="submit">
        {realWhatsAppReady ? "Enviar por WhatsApp" : "Registrar respuesta simulada"}
      </Button>
    </form>
  );
}
