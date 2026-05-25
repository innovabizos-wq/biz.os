import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { INBOX_CHANNEL_LABELS, INBOX_STATUS_LABELS } from "@/modules/inbox/constants";
import type { InboxConversation } from "@/modules/inbox/types";

type InboxConversationsTableProps = {
  conversations: InboxConversation[];
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("es-CR") : "Sin mensajes";
}

export function InboxConversationsTable({
  conversations,
}: InboxConversationsTableProps) {
  return (
    <div className="overflow-auto rounded-lg border bg-background">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Canal</th>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Asignado</th>
            <th className="px-4 py-3">Ultimo mensaje</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {conversations.map((conversation) => (
            <tr className="border-t" key={conversation.id}>
              <td className="px-4 py-3">
                {INBOX_CHANNEL_LABELS[conversation.canal]}
              </td>
              <td className="px-4 py-3 font-medium">
                {conversation.contactoNombre ??
                  conversation.contactoUsuario ??
                  conversation.contactoTelefono ??
                  "Sin contacto"}
              </td>
              <td className="px-4 py-3">
                {conversation.clienteNombre ?? "Sin vincular"}
              </td>
              <td className="px-4 py-3">
                {INBOX_STATUS_LABELS[conversation.estado]}
              </td>
              <td className="px-4 py-3">{conversation.prioridad}</td>
              <td className="px-4 py-3">
                {conversation.asignadoNombre ?? "Sin asignar"}
              </td>
              <td className="max-w-xs truncate px-4 py-3">
                {conversation.ultimoMensaje ?? "Sin mensajes"}
              </td>
              <td className="px-4 py-3">
                {formatDate(conversation.ultimoMensajeAt)}
              </td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/inbox/conversaciones/${conversation.id}`}
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
