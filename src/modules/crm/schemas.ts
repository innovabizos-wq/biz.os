import { z } from "zod";

import {
  CRM_CLIENTE_ESTADOS,
  CRM_CLIENTE_GENEROS,
  CRM_CLIENTE_TIPOS,
  CRM_INTERACCION_TIPOS,
  CRM_SEGUIMIENTO_ESTADOS,
} from "@/modules/crm/constants";
import {
  emailSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalEmailSchema = emailSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const crmClienteTipoSchema = z.enum(CRM_CLIENTE_TIPOS);
export const crmClienteEstadoSchema = z.enum(CRM_CLIENTE_ESTADOS);
export const crmClienteGeneroSchema = z.enum(CRM_CLIENTE_GENEROS);
export const crmInteraccionTipoSchema = z.enum(CRM_INTERACCION_TIPOS);
export const crmSeguimientoEstadoSchema = z.enum(CRM_SEGUIMIENTO_ESTADOS);

export const createCustomerSchema = z.object({
  asignadoA: optionalFormUuidSchema,
  correo: optionalEmailSchema,
  genero: crmClienteGeneroSchema.default("o"),
  identificacion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
  notas: optionalTextSchema,
  origen: optionalTextSchema,
  telefono: optionalTextSchema,
  tipo: crmClienteTipoSchema,
  whatsapp: optionalTextSchema,
});

export const updateCustomerSchema = createCustomerSchema.extend({
  clienteId: uuidSchema,
  estado: crmClienteEstadoSchema,
});

export const createInteractionSchema = z.object({
  clienteId: uuidSchema,
  resultado: optionalTextSchema,
  resumen: nonEmptyTextSchema,
  tipo: crmInteraccionTipoSchema,
});

export const createFollowupSchema = z.object({
  asignadoA: optionalFormUuidSchema,
  asunto: nonEmptyTextSchema,
  clienteId: uuidSchema,
  descripcion: optionalTextSchema,
  fechaProgramada: nonEmptyTextSchema,
});

export const changeFollowupStatusSchema = z.object({
  estado: crmSeguimientoEstadoSchema,
  seguimientoId: uuidSchema,
});
