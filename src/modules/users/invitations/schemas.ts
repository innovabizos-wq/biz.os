import { z } from "zod";

import {
  emailSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  optionalUuidSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

export const createInvitationSchema = z.object({
  correo: emailSchema,
  nombre: nonEmptyTextSchema,
  rolId: uuidSchema,
  sucursalId: optionalUuidSchema,
});

export const acceptInvitationSchema = z.object({
  nombreUsuario: optionalTextSchema,
  telefonoUsuario: optionalTextSchema,
  token: nonEmptyTextSchema,
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
