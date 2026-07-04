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
        <li>Webhook GET preparado para verificar el verify token.</li>
        <li>Webhook POST preparado para recibir mensajes entrantes.</li>
        <li>Configura esta URL como callback en Meta.</li>
        <li>Suscribe el campo messages para WhatsApp, Messenger o Instagram.</li>
        <li>La recepcion guarda conversaciones y mensajes entrantes en Inbox.</li>
        <li>
          El envio WhatsApp queda disponible desde la conversacion cuando el
          canal esta activo, configurado y con credenciales completas.
        </li>
      </ul>
    </div>
  );
}
