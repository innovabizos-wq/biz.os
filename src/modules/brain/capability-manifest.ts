import "server-only";

import { initialBrainAgents } from "@/modules/brain/runtime/orchestration-catalog";
import {
  businessSkillRegistry,
  capabilityRegistry,
} from "@/modules/brain/runtime/default-runtime";
import type { TenantContext } from "@/types/core";

export function getBrainCapabilityManifest(tenant?: TenantContext) {
  const availableSkillIds = tenant
    ? new Set(businessSkillRegistry.getAvailable(tenant).map((skill) => skill.id))
    : null;
  const capabilities = capabilityRegistry.list().map((capability) => {
    const binding = capabilityRegistry.getImplementedBinding(capability.id);
    const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;
    return {
      binding: binding ? { skillId: binding.skillId, version: binding.version } : null,
      description: capability.description,
      enabled: capability.enabled,
      id: capability.id,
      kind: capability.kind,
      module: capability.module,
      name: capability.name,
      requiredPermissions: capability.requiredPermissions,
      skill: skill ? {
        idempotency: skill.idempotency,
        requiresConfirmation: skill.requiresConfirmation,
        risk: skill.risk,
        version: skill.version,
      } : null,
      status: capability.status,
      tenantAvailable: availableSkillIds ? Boolean(binding && availableSkillIds.has(binding.skillId)) : null,
      version: capability.version,
    };
  });
  return {
    agents: initialBrainAgents.map((agent) => ({
      capabilityCount: agent.capabilityIds.length,
      id: agent.id,
      limits: agent.limits,
      name: agent.name,
      version: agent.version,
    })),
    capabilities,
    generatedAt: new Date().toISOString(),
    summary: {
      blocked: capabilities.filter((capability) => capability.status === "blocked").length,
      implemented: capabilities.filter((capability) => capability.status === "implemented").length,
      missingBindings: capabilities.filter((capability) => capability.status === "implemented" && !capability.binding).length,
      planned: capabilities.filter((capability) => capability.status === "planned").length,
      total: capabilities.length,
    },
  };
}
