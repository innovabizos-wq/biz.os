import { z } from "zod";

import { PROFILE_ESTADOS } from "@/modules/users/constants";
import {
  emailSchema,
  nonEmptyTextSchema,
  phoneSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const profileEstadoSchema = z.enum(PROFILE_ESTADOS);
const optionalFormUuidSchema = uuidSchema
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createProfileInternalSchema = z.object({
  correo: emailSchema,
  empresaId: uuidSchema,
  id: uuidSchema,
  nombre: nonEmptyTextSchema,
  rolId: optionalFormUuidSchema,
  sucursalId: optionalFormUuidSchema,
  telefono: phoneSchema,
});

export const createAdministrativeUserSchema = z
  .object({
    cargo: z.string().trim().max(120).optional().or(z.literal("")),
    correo: emailSchema,
    nombre: nonEmptyTextSchema,
    password: z.string().min(12, "La contrasena temporal debe tener al menos 12 caracteres."),
    passwordConfirmation: z.string().min(1),
    rolId: uuidSchema,
    sucursalId: optionalFormUuidSchema,
    telefono: phoneSchema,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Las contrasenas no coinciden.",
    path: ["passwordConfirmation"],
  });

export const updateProfileSchema = z.object({
  nombre: nonEmptyTextSchema.optional(),
  rolId: optionalFormUuidSchema,
  sucursalId: optionalFormUuidSchema,
  telefono: phoneSchema,
});

export const updateUserSchema = z.object({
  nombre: nonEmptyTextSchema,
  profileId: uuidSchema,
  telefono: phoneSchema,
});

export const changeUserRoleSchema = z.object({
  profileId: uuidSchema,
  rolId: uuidSchema,
});

export const changeUserBranchSchema = z.object({
  profileId: uuidSchema,
  sucursalId: optionalFormUuidSchema,
});

export const changeUserStatusSchema = z.object({
  estado: profileEstadoSchema,
  profileId: uuidSchema,
});

export const updateProfileStatusInternalSchema = z.object({
  estado: profileEstadoSchema,
  profileId: uuidSchema,
});

export type CreateProfileInternalInput = z.infer<
  typeof createProfileInternalSchema
>;
export type CreateAdministrativeUserInput = z.infer<
  typeof createAdministrativeUserSchema
>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProfileStatusInternalInput = z.infer<
  typeof updateProfileStatusInternalSchema
>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
export type ChangeUserBranchInput = z.infer<typeof changeUserBranchSchema>;
export type ChangeUserStatusInput = z.infer<typeof changeUserStatusSchema>;
