import type { InboxWebhookEvent } from "@/modules/inbox/types";

type InboxWebhookEventsPanelProps = {
  description?: string;
  emptyMessage?: string;
  events: InboxWebhookEvent[];
  title?: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function ProcessingBadge({ processed }: { processed: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
        processed
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {processed ? "Procesado" : "Pendiente/error"}
    </span>
  );
}

function ShortValue({ value }: { value: string | null }) {
  return (
    <span className="break-all font-mono text-xs text-muted-foreground">
      {value ?? "-"}
    </span>
  );
}

export function InboxWebhookEventsPanel({
  description = "Muestra los ultimos 10 eventos recibidos para este canal. No muestra secretos ni payload completo.",
  emptyMessage = "Todavia no se han recibido eventos webhook para este canal.",
  events,
  title = "Ultimos eventos webhook",
}: InboxWebhookEventsPanelProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
          {events.length}/10
        </span>
      </div>

      {events.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Recibido</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Objeto/evento</th>
                <th className="px-3 py-2">Message ID</th>
                <th className="px-3 py-2">Sender</th>
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="whitespace-nowrap px-3 py-3">
                    {formatDateTime(event.receivedAt)}
                  </td>
                  <td className="px-3 py-3">{event.canal ?? "-"}</td>
                  <td className="px-3 py-3">
                    <div className="font-medium">{event.objectType ?? "-"}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.eventType ?? "-"}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <ShortValue value={event.externalMessageId} />
                  </td>
                  <td className="px-3 py-3">
                    <ShortValue value={event.externalSenderId} />
                  </td>
                  <td className="px-3 py-3">
                    <ShortValue value={event.externalRecipientId} />
                  </td>
                  <td className="px-3 py-3">
                    <ProcessingBadge processed={event.procesado} />
                  </td>
                  <td className="max-w-72 px-3 py-3 text-xs text-destructive">
                    {event.error ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
