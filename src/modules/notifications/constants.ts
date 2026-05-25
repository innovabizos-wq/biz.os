import type { NotificationType } from "@/modules/notifications/types";

export const NOTIFICATION_TYPES = [
  "info",
  "success",
  "warning",
  "error",
  "task",
  "crm",
  "quote",
  "sale",
  "dispatch",
  "inventory",
  "system",
] as const satisfies readonly NotificationType[];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  crm: "CRM",
  dispatch: "Despacho",
  error: "Error",
  info: "Info",
  inventory: "Inventario",
  quote: "Cotizacion",
  sale: "Venta",
  success: "Exito",
  system: "Sistema",
  task: "Tarea",
  warning: "Aviso",
};
