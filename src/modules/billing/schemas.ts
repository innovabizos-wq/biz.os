import { z } from "zod";

import { optionalTextSchema, uuidSchema } from "@/lib/validation/shared-schemas";

export const fiscalEnvironmentSchema = z.enum(["pruebas", "produccion"]);

export const fiscalConfigurationSchema = z.object({
  actividadEconomica: z.string().trim().min(1, "Indica la actividad economica."),
  ambiente: fiscalEnvironmentSchema.default("pruebas"),
  correoEmisor: z.string().trim().email("Correo emisor invalido."),
  haciendaPassword: optionalTextSchema,
  haciendaUsuario: optionalTextSchema,
  identificacion: z.string().trim().min(9, "Indica la identificacion fiscal."),
  p12Base64: optionalTextSchema,
  pin: optionalTextSchema,
  razonSocial: z.string().trim().min(2, "Indica la razon social."),
  sucursal: z.string().trim().regex(/^\d{3}$/, "Sucursal debe tener 3 digitos."),
  terminal: z.string().trim().regex(/^\d{5}$/, "Terminal debe tener 5 digitos."),
  tipoIdentificacion: z.enum(["01", "02", "03", "04"]).default("02"),
});

export const issueInvoiceSchema = z.object({
  actividadEconomica: z.string().trim().min(1),
  condicionVenta: z.string().trim().min(1),
  correoReceptor: z.string().trim().email().optional().or(z.literal("")),
  identificacionReceptor: optionalTextSchema,
  medioPago: z.string().trim().min(1),
  nombreReceptor: optionalTextSchema,
  ventaId: uuidSchema,
});
