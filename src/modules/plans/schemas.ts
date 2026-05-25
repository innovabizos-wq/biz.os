import { z } from "zod";

import { EMPRESA_PLAN_ESTADOS, PLAN_CODES } from "@/modules/plans/constants";
import { jsonRecordSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const planCodeSchema = z.enum(PLAN_CODES);
export const empresaPlanEstadoSchema = z.enum(EMPRESA_PLAN_ESTADOS);

export const assignPlanToCompanySchema = z.object({
  limitesOverride: jsonRecordSchema.optional(),
  planCode: planCodeSchema,
  renovacionAutomatica: z.boolean().optional(),
});

export const assignPlanToCompanyInternalSchema = assignPlanToCompanySchema.extend({
  empresaId: uuidSchema,
});

export type AssignPlanToCompanyInput = z.infer<typeof assignPlanToCompanySchema>;
export type AssignPlanToCompanyInternalInput = z.infer<
  typeof assignPlanToCompanyInternalSchema
>;
