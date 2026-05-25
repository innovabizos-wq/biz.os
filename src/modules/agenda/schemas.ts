import { z } from "zod";

import {
  AGENDA_ESTADO_FILTERS,
  AGENDA_RANGES,
  AGENDA_SCOPES,
  DEFAULT_AGENDA_ESTADO,
  DEFAULT_AGENDA_RANGE,
  DEFAULT_AGENDA_SCOPE,
} from "@/modules/agenda/constants";
import { uuidSchema } from "@/lib/validation/shared-schemas";

const optionalDateTimeSchema = z
  .string()
  .datetime()
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const agendaScopeSchema = z.enum(AGENDA_SCOPES);
export const agendaEstadoFilterSchema = z.enum(AGENDA_ESTADO_FILTERS);
export const agendaRangeSchema = z.enum(AGENDA_RANGES);

export const agendaFiltersSchema = z.object({
  desde: optionalDateTimeSchema,
  estado: agendaEstadoFilterSchema.default(DEFAULT_AGENDA_ESTADO),
  hasta: optionalDateTimeSchema,
  scope: agendaScopeSchema.default(DEFAULT_AGENDA_SCOPE),
});

export const agendaSearchParamsSchema = agendaFiltersSchema.extend({
  range: agendaRangeSchema.default(DEFAULT_AGENDA_RANGE),
});

export const agendaStatusActionSchema = z.object({
  clienteId: uuidSchema.optional(),
  seguimientoId: uuidSchema,
});

export const reassignFollowupSchema = z.object({
  asignadoA: optionalFormUuidSchema,
  seguimientoId: uuidSchema,
});

export type AgendaFiltersInput = z.infer<typeof agendaFiltersSchema>;
export type AgendaSearchParamsInput = z.infer<typeof agendaSearchParamsSchema>;
export type AgendaStatusActionInput = z.infer<typeof agendaStatusActionSchema>;
export type ReassignFollowupInput = z.infer<typeof reassignFollowupSchema>;
