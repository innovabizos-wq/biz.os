import { z } from "zod";

import { SUCURSAL_ESTADOS } from "@/modules/branches/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  phoneSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const sucursalEstadoSchema = z.enum(SUCURSAL_ESTADOS);

export const createSucursalSchema = z.object({
  codigo: optionalTextSchema,
  direccion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  telefono: phoneSchema,
});

export const createSucursalInternalSchema = createSucursalSchema.extend({
  empresaId: uuidSchema,
});

export const updateSucursalSchema = createSucursalSchema
  .extend({
    estado: sucursalEstadoSchema.optional(),
  })
  .partial();

export type CreateSucursalInput = z.infer<typeof createSucursalSchema>;
export type CreateSucursalInternalInput = z.infer<
  typeof createSucursalInternalSchema
>;
export type UpdateSucursalInput = z.infer<typeof updateSucursalSchema>;
