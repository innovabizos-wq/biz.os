import { z } from "zod";

import { emailSchema, nonEmptyTextSchema, optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";
import { CRM_INTERACCION_TIPOS } from "@/modules/crm/constants";

export function normalizeConsultationDocument(value: string) {
  return value.trim().replace(/[\s-]/g, "").replace(/[^\d]/g, "");
}

const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalEmailSchema = emailSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const consultationSearchSchema = z.object({
  documento: z
    .string()
    .trim()
    .transform(normalizeConsultationDocument)
    .refine((value) => /^\d{9,12}$/.test(value), {
      message: "La identificacion debe tener entre 9 y 12 digitos numericos.",
    }),
});

export const haciendaDocumentSchema = z
  .string()
  .transform(normalizeConsultationDocument)
  .refine((value) => /^\d{9,12}$/.test(value), {
    message: "La identificacion debe tener entre 9 y 12 digitos numericos.",
  });

export const consultationSaveSchema = z.object({
  clienteId: optionalFormUuidSchema,
  correo: optionalEmailSchema,
  descripcionGestion: nonEmptyTextSchema.min(3),
  direccion: optionalTextSchema,
  documento: haciendaDocumentSchema,
  interaccionResultado: optionalTextSchema,
  interaccionTipo: z.enum(CRM_INTERACCION_TIPOS).default("nota"),
  intent: z.enum(["save", "quote"]),
  nombre: nonEmptyTextSchema,
  origen: optionalTextSchema,
  regimen: optionalTextSchema,
  situacion: optionalTextSchema,
  source: z.enum(["internal", "hacienda", "manual"]),
  telefono: optionalTextSchema,
  tipo: z.enum(["prospecto", "cliente"]).default("prospecto"),
  tipoIdentificacion: optionalTextSchema,
  whatsapp: optionalTextSchema,
});

export const consultationCustomerStepSchema = consultationSaveSchema
  .omit({
    descripcionGestion: true,
    interaccionResultado: true,
    interaccionTipo: true,
    intent: true,
  })
  .extend({
    origen: nonEmptyTextSchema,
  });

export type ConsultationSearchInput = z.infer<typeof consultationSearchSchema>;
export type ConsultationCustomerStepInput = z.infer<
  typeof consultationCustomerStepSchema
>;
export type ConsultationSaveInput = z.infer<typeof consultationSaveSchema>;
