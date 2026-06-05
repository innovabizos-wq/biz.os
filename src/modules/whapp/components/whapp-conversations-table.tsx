import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { INBOX_CHANNEL_LABELS, INBOX_STATUS_LABELS } from "@/modules/inbox/constants";
import type { InboxConversation } from "@/modules/inbox/types";

type WhappConversationsTableProps = {
  conversations: InboxConversation[];
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-CR") : "Sin mensajes";
}

function statusLabel(status: InboxConversation["estado"]) {
  if (status === "pendiente") return "Sin asignar";
  return INBOX_STATUS_LABELS[status];
}

function UnreadBadge() {
  return (
    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
      0
    </span>
  );
}

export function WhappConversationsTable({
  conversations,
}: WhappConversationsTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Agente</th>
            <th className="px-4 py-3">No leidos</th>
            <th className="px-4 py-3">Ultimo mensaje</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((conversation) => (
            <tr className="border-t" key={conversation.id}>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                  {INBOX_CHANNEL_LABELS[conversation.canal]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">
                  {conversation.contactoNombre ??
                    conversation.contactoUsuario ??
                    conversation.contactoTelefono ??
                    "Sin contacto"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conversation.contactoTelefono ??
                    conversation.contactoIdentificador ??
                    "Sin telefono"}
                </div>
              </td>
              <td className="px-4 py-3">
                {conversation.clienteNombre ?? "Sin vincular"}
              </td>
              <td className="px-4 py-3">{statusLabel(conversation.estado)}</td>
              <td className="px-4 py-3">
                {conversation.asignadoNombre ?? "Sin asignar"}
              </td>
              <td className="px-4 py-3">
                <UnreadBadge />
              </td>
              <td className="max-w-sm truncate px-4 py-3">
                {conversation.ultimoMensaje ?? "Sin mensajes"}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {formatDate(conversation.ultimoMensajeAt)}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/whapp/conversaciones/${conversation.id}`}
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
