export const INBOX_CHANNELS = [
  "whatsapp",
  "facebook",
  "instagram",
  "email",
  "manual",
] as const;

export const INBOX_CHANNEL_PROVIDERS = ["manual", "meta", "email"] as const;

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

export const INBOX_SLA_STATUSES = [
  "ok",
  "riesgo",
  "vencido",
  "pausado",
] as const;

export const INBOX_META_TEMPLATE_CATEGORIES = [
  "AUTHENTICATION",
  "MARKETING",
  "UTILITY",
] as const;

export const INBOX_META_TEMPLATE_STATUSES = [
  "borrador",
  "pendiente",
  "aprobada",
  "rechazada",
  "pausada",
] as const;

export const INBOX_CAMPAIGN_STATUSES = [
  "borrador",
  "programada",
  "enviando",
  "enviada",
  "pausada",
  "cancelada",
] as const;

export const INBOX_CAMPAIGN_RECIPIENT_STATUSES = [
  "pendiente",
  "listo",
  "en_cola",
  "enviado",
  "entregado",
  "leido",
  "respondido",
  "fallido",
  "excluido",
] as const;

export const INBOX_AUTOMATION_TRIGGERS = [
  "conversacion_creada",
  "mensaje_entrante",
  "palabra_clave",
  "sla_en_riesgo",
  "sla_vencido",
] as const;

export const INBOX_AUTOMATION_ACTIONS = [
  "crear_sugerencia",
  "agregar_nota",
  "asignar_usuario",
  "cambiar_estado",
  "enviar_plantilla",
] as const;

export const INBOX_AUTOMATION_MODES = [
  "sugerida",
  "asistida",
  "automatica",
] as const;

export const INBOX_AUTOMATION_STATUSES = [
  "activa",
  "inactiva",
  "pausada",
] as const;

export const INBOX_SLA_FIRST_RESPONSE_MINUTES = 30;

export const INBOX_SLA_WARNING_MINUTES = 10;

export const INBOX_CHANNEL_LABELS = {
  email: "Correo",
  facebook: "Facebook Messenger",
  instagram: "Instagram DM",
  manual: "Manual",
  whatsapp: "WhatsApp",
} as const;

export const INBOX_CHANNEL_VISUALS = {
  email: {
    accentClassName: "border-sky-200 bg-sky-50 text-sky-800",
    icon: "@",
    shortLabel: "Email",
  },
  facebook: {
    accentClassName: "border-blue-200 bg-blue-50 text-blue-800",
    icon: "f",
    shortLabel: "FB",
  },
  instagram: {
    accentClassName: "border-pink-200 bg-pink-50 text-pink-800",
    icon: "ig",
    shortLabel: "IG",
  },
  manual: {
    accentClassName: "border-slate-200 bg-slate-50 text-slate-700",
    icon: "M",
    shortLabel: "Manual",
  },
  whatsapp: {
    accentClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: "wa",
    shortLabel: "WA",
  },
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

export const INBOX_SLA_STATUS_LABELS = {
  ok: "Al dia",
  pausado: "Pausado",
  riesgo: "En riesgo",
  vencido: "Vencido",
} as const;

export const INBOX_META_TEMPLATE_CATEGORY_LABELS = {
  AUTHENTICATION: "Autenticacion",
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
} as const;

export const INBOX_META_TEMPLATE_STATUS_LABELS = {
  aprobada: "Aprobada",
  borrador: "Borrador",
  pausada: "Pausada",
  pendiente: "Pendiente",
  rechazada: "Rechazada",
} as const;

export const INBOX_CAMPAIGN_STATUS_LABELS = {
  borrador: "Borrador",
  cancelada: "Cancelada",
  enviada: "Enviada",
  enviando: "Enviando",
  pausada: "Pausada",
  programada: "Programada",
} as const;

export const INBOX_CAMPAIGN_RECIPIENT_STATUS_LABELS = {
  entregado: "Entregado",
  en_cola: "En cola",
  enviado: "Enviado",
  excluido: "Excluido",
  fallido: "Fallido",
  leido: "Leido",
  listo: "Listo",
  pendiente: "Pendiente",
  respondido: "Respondido",
} as const;

export const INBOX_AUTOMATION_TRIGGER_LABELS = {
  conversacion_creada: "Conversacion creada",
  mensaje_entrante: "Mensaje entrante",
  palabra_clave: "Palabra clave",
  sla_en_riesgo: "SLA en riesgo",
  sla_vencido: "SLA vencido",
} as const;

export const INBOX_AUTOMATION_ACTION_LABELS = {
  agregar_nota: "Agregar nota",
  asignar_usuario: "Asignar usuario",
  cambiar_estado: "Cambiar estado",
  crear_sugerencia: "Crear sugerencia",
  enviar_plantilla: "Enviar plantilla",
} as const;

export const INBOX_AUTOMATION_MODE_LABELS = {
  asistida: "Asistida",
  automatica: "Automatica",
  sugerida: "Sugerida",
} as const;

export const INBOX_AUTOMATION_STATUS_LABELS = {
  activa: "Activa",
  inactiva: "Inactiva",
  pausada: "Pausada",
} as const;
