import { z } from "zod";

import {
  MODULO_ESTADOS,
  MODULE_CODES,
} from "@/modules/platform-modules/constants";
import { jsonRecordSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const moduleCodeSchema = z.enum(MODULE_CODES);
export const moduloEstadoSchema = z.enum(MODULO_ESTADOS);

export const activateModuleForCompanySchema = z.object({
  configuracion: jsonRecordSchema.optional(),
  moduleCode: moduleCodeSchema,
});

export const activateModuleForCompanyInternalSchema =
  activateModuleForCompanySchema.extend({
    empresaId: uuidSchema,
  });

export type ActivateModuleForCompanyInput = z.infer<
  typeof activateModuleForCompanySchema
>;
export type ActivateModuleForCompanyInternalInput = z.infer<
  typeof activateModuleForCompanyInternalSchema
>;
