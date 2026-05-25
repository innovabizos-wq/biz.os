import type { InboxMessage } from "@/modules/inbox/types";

type InboxMessageThreadProps = {
  messages: InboxMessage[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-CR");
}

export function InboxMessageThread({ messages }: InboxMessageThreadProps) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex max-h-[58vh] min-h-80 flex-col gap-3 overflow-auto pr-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mensajes registrados.</p>
        ) : null}
        {messages.map((message) => {
          const isOutgoing = message.direccion === "saliente";
          const isInternal = message.esNotaInterna;

          return (
            <article
              className={[
                "max-w-[82%] rounded-lg border p-3 text-sm",
                isOutgoing ? "ml-auto bg-primary text-primary-foreground" : "",
                !isOutgoing && !isInternal ? "mr-auto bg-muted" : "",
                isInternal ? "mx-auto border-dashed bg-amber-50 text-amber-950" : "",
              ].join(" ")}
              key={message.id}
            >
              <div className="mb-1 flex items-center justify-between gap-3 text-xs opacity-75">
                <span>
                  {isInternal
                    ? "Nota interna"
                    : isOutgoing
                      ? "Respuesta simulada"
                      : "Entrante simulado"}
                </span>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap">{message.contenido}</p>
              {message.enviadoPorNombre ? (
                <p className="mt-2 text-xs opacity-75">{message.enviadoPorNombre}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
