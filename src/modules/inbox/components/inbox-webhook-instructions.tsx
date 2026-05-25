type InboxWebhookInstructionsProps = {
  callbackUrl: string;
};

export function InboxWebhookInstructions({
  callbackUrl,
}: InboxWebhookInstructionsProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="font-semibold">Webhook sugerido</p>
      <p className="mt-2 break-all rounded-md bg-muted p-3 font-mono text-sm">
        {callbackUrl}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li>Webhook GET/POST preparado para verificacion y recepcion.</li>
        <li>Configura esta URL como callback en Meta.</li>
        <li>La recepcion guarda mensajes entrantes en Inbox.</li>
        <li>No se reciben ni envian mensajes reales en esta fase.</li>
        <li>El envio de mensajes se implementara en la siguiente fase.</li>
      </ul>
    </div>
  );
}
