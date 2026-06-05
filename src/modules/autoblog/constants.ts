import type {
  AutoblogSourceMode,
  AutoblogStatus,
  AutoblogTopicStatus,
} from "@/modules/autoblog/types";

export const AUTOBLOG_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "ready_to_publish",
  "archived",
] as const satisfies readonly AutoblogStatus[];

export const AUTOBLOG_STATUS_LABELS: Record<AutoblogStatus, string> = {
  approved: "Aprobado",
  archived: "Archivado",
  draft: "Borrador",
  pending_review: "En revisión",
  ready_to_publish: "Listo para publicar",
};

export const AUTOBLOG_SOURCE_MODES = [
  "manual",
  "news",
  "trend",
  "internal_context",
] as const satisfies readonly AutoblogSourceMode[];

export const AUTOBLOG_SOURCE_MODE_LABELS: Record<AutoblogSourceMode, string> = {
  internal_context: "Contexto interno",
  manual: "Tema manual",
  news: "Fuente/noticia manual",
  trend: "Tendencia manual",
};

export const AUTOBLOG_TOPIC_STATUSES = [
  "new",
  "selected",
  "used",
  "discarded",
] as const satisfies readonly AutoblogTopicStatus[];
