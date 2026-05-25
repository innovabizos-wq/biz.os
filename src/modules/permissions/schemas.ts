import { z } from "zod";

import { PERMISSION_CODES } from "@/modules/permissions/constants";
import { uuidSchema } from "@/lib/validation/shared-schemas";

export const permissionCodeSchema = z.enum(PERMISSION_CODES);

export const assignPermissionToRoleSchema = z.object({
  permissionCode: permissionCodeSchema,
  rolId: uuidSchema,
});

export const assignPermissionToRoleInternalSchema =
  assignPermissionToRoleSchema.extend({
    empresaId: uuidSchema,
  });

export type AssignPermissionToRoleInput = z.infer<
  typeof assignPermissionToRoleSchema
>;
export type AssignPermissionToRoleInternalInput = z.infer<
  typeof assignPermissionToRoleInternalSchema
>;
