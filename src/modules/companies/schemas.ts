import { z } from "zod";

import { EMPRESA_ESTADOS } from "@/modules/companies/constants";
import {
  emailSchema,
  jsonRecordSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const empresaEstadoSchema = z.enum(EMPRESA_ESTADOS);

export const createEmpresaSchema = z.object({
  correo: emailSchema.optional(),
  identificacionFiscal: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  nombreComercial: optionalTextSchema,
  telefono: optionalTextSchema,
});

export const updateEmpresaSchema = createEmpresaSchema
  .extend({
    estado: empresaEstadoSchema.optional(),
  })
  .partial();

export const setConfiguracionEmpresaSchema = z.object({
  clave: nonEmptyTextSchema,
  valor: jsonRecordSchema,
});

export const setConfiguracionEmpresaInternalSchema =
  setConfiguracionEmpresaSchema.extend({
    empresaId: uuidSchema,
  });

export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;
export type SetConfiguracionEmpresaInput = z.infer<
  typeof setConfiguracionEmpresaSchema
>;
export type SetConfiguracionEmpresaInternalInput = z.infer<
  typeof setConfiguracionEmpresaInternalSchema
>;
