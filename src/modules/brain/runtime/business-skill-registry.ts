import { hasEveryPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import type {
  BusinessSkillDefinition,
  BusinessSkillRegistry,
} from "@/modules/brain/runtime/contracts";
import type { CoreResult } from "@/types/core";
import { fail, ok } from "@/types/core";

export function createBusinessSkillRegistry(
  initialSkills: BusinessSkillDefinition[] = [],
): BusinessSkillRegistry {
  const skills = new Map<string, BusinessSkillDefinition>();

  for (const skill of initialSkills) {
    skills.set(skill.id, skill);
  }

  return {
    exists(skillId) {
      return skills.has(skillId);
    },
    get(skillId) {
      return skills.get(skillId) ?? null;
    },
    getAvailable(tenant) {
      return Array.from(skills.values()).filter(
        (skill) =>
          skill.enabled &&
          isModuleActive(tenant.activeModules, skill.module) &&
          hasEveryPermission(tenant.permissions, skill.requiredPermissions),
      );
    },
    getByLegacyActionId(actionId) {
      return (
        Array.from(skills.values()).find(
          (skill) => skill.legacyActionId === actionId,
        ) ?? null
      );
    },
    list() {
      return Array.from(skills.values());
    },
    register(skill): CoreResult<BusinessSkillDefinition> {
      if (skills.has(skill.id)) {
        return fail(
          "VALIDATION_ERROR",
          `La Business Skill ya existe: ${skill.id}.`,
        );
      }

      if (
        skill.legacyActionId &&
        Array.from(skills.values()).some(
          (current) => current.legacyActionId === skill.legacyActionId,
        )
      ) {
        return fail(
          "VALIDATION_ERROR",
          `La accion heredada ya tiene una Business Skill: ${skill.legacyActionId}.`,
        );
      }

      skills.set(skill.id, skill);
      return ok(skill);
    },
  };
}
