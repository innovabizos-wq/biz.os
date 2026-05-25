import type { InboxWidgetConversation } from "@/modules/inbox-widget/types";

export function getWidgetContactName(conversation: InboxWidgetConversation) {
  return (
    conversation.contactoNombre ??
    conversation.clienteNombre ??
    conversation.contactoUsuario ??
    conversation.contactoTelefono ??
    conversation.contactoIdentificador ??
    "Contacto sin nombre"
  );
}

export function getWidgetInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatWidgetTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) {
    return date.toLocaleTimeString("es-CR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "2-digit",
  });
}
