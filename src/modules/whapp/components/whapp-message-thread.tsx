import type { InboxMessage } from "@/modules/inbox/types";

type WhappMessageThreadProps = {
  messages: InboxMessage[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CR");
}

function messageLabel(message: InboxMessage) {
  if (message.esNotaInterna || message.direccion === "interna") return "Nota interna";
  if (message.direccion === "saliente") return "Saliente WhatsApp";
  return "Entrante WhatsApp";
}

export function WhappMessageThread({ messages }: WhappMessageThreadProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex max-h-[62vh] min-h-96 flex-col gap-3 overflow-auto pr-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mensajes registrados.</p>
        ) : null}
        {messages.map((message) => {
          const isOutgoing = message.direccion === "saliente";
          const isInternal = message.esNotaInterna || message.direccion === "interna";

          return (
            <article
              className={[
                "max-w-[84%] rounded-lg border p-3 text-sm",
                isOutgoing ? "ml-auto bg-primary text-primary-foreground" : "",
                !isOutgoing && !isInternal ? "mr-auto bg-muted" : "",
                isInternal ? "mx-auto border-dashed bg-amber-50 text-amber-950" : "",
              ].join(" ")}
              key={message.id}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-xs opacity-75">
                <span>{messageLabel(message)}</span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.contenido}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs opacity-75">
                <span>Estado: {message.estado}</span>
                {message.canalMessageId ? (
                  <span className="break-all font-mono">
                    WAMID: {message.canalMessageId}
                  </span>
                ) : null}
                {message.enviadoPorNombre ? <span>{message.enviadoPorNombre}</span> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
