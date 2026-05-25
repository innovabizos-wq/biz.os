import { z } from "zod";

import { TIMESHEET_STATE_TYPES } from "@/modules/hr-timesheets/constants";
import { uuidSchema } from "@/lib/validation/shared-schemas";

const stateCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9_]+$/, "Usa solo minusculas, numeros y guion bajo.");

const optionalStateCodeSchema = z
  .string()
  .trim()
  .max(48)
  .optional()
  .transform((value) => (value ? value : undefined));

const checkboxSchema = z
  .union([
    z.literal("on"),
    z.literal("true"),
    z.literal("false"),
    z.literal("1"),
    z.literal("0"),
    z.boolean(),
  ])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true" || value === "1");

const numberFromFormSchema = z.coerce.number().int().min(0).max(999).default(0);

export const registerTimesheetStatusSchema = z.object({
  estadoCodigo: stateCodeSchema,
  notas: z.string().trim().max(220).optional(),
  redirectTo: z.string().trim().optional(),
});

export const createTimesheetStateSchema = z.object({
  codigo: stateCodeSchema,
  color: z.string().trim().max(32).optional(),
  cuentaComoPausa: checkboxSchema,
  cuentaComoTrabajo: checkboxSchema,
  estadoRegresoCodigo: optionalStateCodeSchema,
  nombre: z.string().trim().min(2).max(80),
  orden: numberFromFormSchema,
  requiereRegreso: checkboxSchema,
  tipo: z.enum(TIMESHEET_STATE_TYPES),
});

export const updateTimesheetStateSchema = createTimesheetStateSchema.extend({
  estadoId: uuidSchema,
});

export const toggleTimesheetStateSchema = z.object({
  activo: checkboxSchema,
  estadoId: uuidSchema,
});
