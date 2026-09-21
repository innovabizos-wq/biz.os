import type {
  BrainToolDefinition,
  BrainToolRegistry,
} from "@/modules/brain/core/contracts";
import { hasEveryPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createBrainSystemTools } from "@/modules/brain/core/system-tools";
import type { CoreResult } from "@/types/core";
import { fail, ok } from "@/types/core";

function normalizeTool(tool: BrainToolDefinition): BrainToolDefinition {
  return {
    ...tool,
    enabled: tool.enabled,
  };
}

export function createBrainToolRegistry(
  initialTools: BrainToolDefinition[] = [],
): BrainToolRegistry {
  const tools = new Map<string, BrainToolDefinition>();

  for (const tool of initialTools) {
    tools.set(tool.id, normalizeTool(tool));
  }

  return {
    disable(toolId) {
      const tool = tools.get(toolId);
      if (!tool) {
        return fail("VALIDATION_ERROR", `La herramienta Brain no existe: ${toolId}.`);
      }

      const next = { ...tool, enabled: false };
      tools.set(toolId, next);
      return ok(next);
    },
    enable(toolId) {
      const tool = tools.get(toolId);
      if (!tool) {
        return fail("VALIDATION_ERROR", `La herramienta Brain no existe: ${toolId}.`);
      }

      const next = { ...tool, enabled: true };
      tools.set(toolId, next);
      return ok(next);
    },
    exists(toolId) {
      return tools.has(toolId);
    },
    get(toolId) {
      return tools.get(toolId) ?? null;
    },
    getAvailable(tenant) {
      return Array.from(tools.values()).filter(
        (tool) =>
          tool.enabled &&
          isModuleActive(tenant.activeModules, tool.module) &&
          hasEveryPermission(tenant.permissions, tool.requiredPermissions),
      );
    },
    getByModule(module) {
      return Array.from(tools.values()).filter((tool) => tool.module === module);
    },
    list() {
      return Array.from(tools.values());
    },
    register(tool): CoreResult<BrainToolDefinition> {
      if (tools.has(tool.id)) {
        return fail("VALIDATION_ERROR", `La herramienta Brain ya existe: ${tool.id}.`);
      }

      const next = normalizeTool(tool);
      tools.set(tool.id, next);
      return ok(next);
    },
  };
}

export const brainToolRegistry = createBrainToolRegistry(createBrainSystemTools());
