import { z } from "zod";

import { permissionCodeSchema } from "@/modules/permissions/schemas";
import { moduleCodeSchema } from "@/modules/platform-modules/schemas";
import { planCodeSchema } from "@/modules/plans/schemas";
import { uuidSchema } from "@/lib/validation/shared-schemas";

function getCodeFromRelation(value: unknown): unknown {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.codigo === "string") {
    return record.codigo;
  }

  return value;
}

function normalizeCodeList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map(getCodeFromRelation);
}

const optionalTenantUuidSchema = uuidSchema
  .nullish()
  .transform((value) => value ?? undefined);

const optionalTenantPlanCodeSchema = planCodeSchema
  .nullish()
  .transform((value) => value ?? undefined);

export const tenantContextInputSchema = z.object({
  activeModules: z.preprocess(normalizeCodeList, z.array(moduleCodeSchema)),
  empresaId: uuidSchema,
  permissions: z.preprocess(normalizeCodeList, z.array(permissionCodeSchema)),
  planCode: optionalTenantPlanCodeSchema,
  profileEmail: z.string().email().optional(),
  profileId: uuidSchema,
  profileName: z.string().min(1).optional(),
  rolId: optionalTenantUuidSchema,
  sucursalId: optionalTenantUuidSchema,
});

export type TenantContextInput = z.infer<typeof tenantContextInputSchema>;
