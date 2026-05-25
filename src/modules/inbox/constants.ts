export const INBOX_CHANNELS = ["whatsapp", "facebook", "instagram", "manual"] as const;

export const INBOX_CHANNEL_PROVIDERS = ["manual", "meta"] as const;

export const INBOX_META_CHANNELS = ["whatsapp", "facebook", "instagram"] as const;

export const INBOX_CHANNEL_STATUSES = [
  "activo",
  "inactivo",
  "pendiente",
  "error",
] as const;

export const INBOX_CONNECTION_STATUSES = [
  "pendiente",
  "configurado",
  "error",
  "inactivo",
] as const;

export const INBOX_CONVERSATION_STATUSES = [
  "abierta",
  "pendiente",
  "cerrada",
  "spam",
] as const;

export const INBOX_PRIORITIES = ["baja", "normal", "alta", "urgente"] as const;

export const INBOX_MESSAGE_DIRECTIONS = [
  "entrante",
  "saliente",
  "interna",
] as const;

export const INBOX_MESSAGE_TYPES = [
  "texto",
  "imagen",
  "audio",
  "video",
  "documento",
  "sistema",
] as const;

export const INBOX_MESSAGE_STATUSES = [
  "registrado",
  "enviado",
  "entregado",
  "leido",
  "fallido",
] as const;

export const INBOX_CHANNEL_LABELS = {
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
  manual: "Manual",
  whatsapp: "WhatsApp",
} as const;

export const INBOX_CONNECTION_STATUS_LABELS = {
  configurado: "Configurado",
  error: "Error",
  inactivo: "Inactivo",
  pendiente: "Pendiente",
} as const;

export const INBOX_STATUS_LABELS = {
  abierta: "Abierta",
  cerrada: "Cerrada",
  pendiente: "Pendiente",
  spam: "Spam",
} as const;
