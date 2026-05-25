import { z } from "zod";

import { PERMISSIONS } from "@/modules/permissions/permissions";
import { ROL_ESTADOS } from "@/modules/roles/constants";
import {
  nonEmptyTextSchema,
  optionalTextSchema,
  uuidSchema,
} from "@/lib/validation/shared-schemas";

const permissionCodes = PERMISSIONS.map((permission) => permission.code);

const permissionCodeSchema = z
  .string()
  .trim()
  .refine((code) => permissionCodes.includes(code as never), {
    message: "Permiso invalido.",
  });

export const rolEstadoSchema = z.enum(ROL_ESTADOS);

export const createRoleSchema = z.object({
  descripcion: optionalTextSchema,
  nombre: nonEmptyTextSchema,
});

export const updateRoleSchema = createRoleSchema.extend({
  rolId: uuidSchema,
});

export const changeRoleStatusSchema = z.object({
  estado: rolEstadoSchema,
  rolId: uuidSchema,
});

export const assignPermissionSchema = z.object({
  permisoCodigo: permissionCodeSchema,
  rolId: uuidSchema,
});

export const removePermissionSchema = assignPermissionSchema;

export const createRolSchema = createRoleSchema;
export const updateRolSchema = updateRoleSchema;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type ChangeRoleStatusInput = z.infer<typeof changeRoleStatusSchema>;
export type AssignPermissionInput = z.infer<typeof assignPermissionSchema>;
