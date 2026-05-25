import type {
  AgendaEstadoFilter,
  AgendaRange,
  AgendaScope,
} from "@/modules/agenda/types";
import { CRM_SEGUIMIENTO_ESTADOS } from "@/modules/crm/constants";

export const AGENDA_SCOPES = [
  "mios",
  "todos",
] as const satisfies readonly AgendaScope[];

export const AGENDA_ESTADO_FILTERS = [
  ...CRM_SEGUIMIENTO_ESTADOS,
  "todos",
] as const satisfies readonly AgendaEstadoFilter[];

export const AGENDA_RANGES = [
  "hoy",
  "vencidos",
  "proximos7",
  "todos",
] as const satisfies readonly AgendaRange[];

export const DEFAULT_AGENDA_SCOPE: AgendaScope = "mios";
export const DEFAULT_AGENDA_ESTADO: AgendaEstadoFilter = "pendiente";
export const DEFAULT_AGENDA_RANGE: AgendaRange = "hoy";
