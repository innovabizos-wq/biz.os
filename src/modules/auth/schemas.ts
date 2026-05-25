import { z } from "zod";

import {
  emailSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const authSessionSchema = z.object({
  email: emailSchema.optional(),
  userId: uuidSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  invitation_token: optionalTextSchema,
  password: z.string().min(1, "La contrasena es requerida."),
});

export const signupSchema = loginSchema.extend({
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres."),
});

export const bootstrapEmpresaInicialSchema = z.object({
  identificacionFiscal: optionalTextSchema,
  nombreComercial: optionalTextSchema,
  nombreEmpresa: nonEmptyTextSchema,
  nombreUsuario: nonEmptyTextSchema,
  telefonoEmpresa: optionalTextSchema,
  telefonoUsuario: optionalTextSchema,
});

export type AuthSessionInput = z.infer<typeof authSessionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type BootstrapEmpresaInicialInput = z.infer<
  typeof bootstrapEmpresaInicialSchema
>;
