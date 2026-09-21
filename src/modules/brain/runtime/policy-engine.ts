import { hasEveryPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  BrainPolicyEngine,
  BusinessSkillDefinition,
} from "@/modules/brain/runtime/contracts";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

const SENSITIVE_ACTION_PATTERN =
  /(?:adjust|transfer|delete|remove|cancel|close|issue|publish|send|dispatch|payment\.register|bulk|campaign)/i;

export function requiresBrainApproval(skill: BusinessSkillDefinition) {
  if (skill.kind === "query" || skill.kind === "analysis") return false;
  if (skill.requiresConfirmation) return true;
  if (skill.risk === "high" || skill.risk === "critical") return true;
  if (skill.idempotency === "required") return true;
  if (["billing", "payments"].includes(skill.module)) return true;
  if (skill.module === "inventory" && SENSITIVE_ACTION_PATTERN.test(skill.id)) return true;
  return SENSITIVE_ACTION_PATTERN.test(`${skill.id} ${skill.name} ${skill.description}`);
}

export function createBrainPolicyEngine(): BrainPolicyEngine {
  return {
    authorize(
      tenant: TenantContext,
      skill: BusinessSkillDefinition,
    ): CoreResult<{ allowed: boolean; reason: string | null }> {
      if (!tenant.profileId || !tenant.empresaId) {
        return fail(
          "INVALID_TENANT_CONTEXT",
          "La Business Skill requiere usuario y empresa activos.",
        );
      }

      if (!skill.enabled) {
        return fail(
          "PERMISSION_DENIED",
          `La Business Skill esta deshabilitada: ${skill.id}.`,
        );
      }

      if (!isModuleActive(tenant.activeModules, skill.module)) {
        return fail(
          "MODULE_INACTIVE",
          `El modulo ${skill.module} no esta activo.`,
        );
      }

      if (!hasEveryPermission(tenant.permissions, skill.requiredPermissions)) {
        return fail(
          "PERMISSION_DENIED",
          "No tienes permisos para usar esta Business Skill.",
        );
      }

      return ok({ allowed: true, reason: null });
    },
  };
}
