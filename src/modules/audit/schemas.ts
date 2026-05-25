import { z } from "zod";

import {
  jsonRecordSchema,
  nonEmptyTextSchema,
  optionalUuidSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const createAuditEventInternalSchema = z.object({
  accion: nonEmptyTextSchema,
  datosAntes: jsonRecordSchema.nullable().optional(),
  datosDespues: jsonRecordSchema.nullable().optional(),
  empresaId: uuidSchema,
  entidad: nonEmptyTextSchema,
  entidadId: optionalUuidSchema,
  ip: z.string().trim().optional(),
  metadata: jsonRecordSchema.optional(),
  sucursalId: optionalUuidSchema,
  userAgent: z.string().trim().optional(),
  usuarioId: optionalUuidSchema,
});

export type CreateAuditEventInternalInput = z.infer<
  typeof createAuditEventInternalSchema
>;
