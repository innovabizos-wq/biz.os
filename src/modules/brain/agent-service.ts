import "server-only";

import {
  businessSkillRegistry,
  capabilityRegistry,
  initialBrainAgents,
} from "@/modules/brain/runtime";
import type { BrainAgentId } from "@/modules/brain/runtime/contracts";
import type { TenantContext } from "@/types/core";

type AgentCapabilitySummary = {
  capabilityId: string;
  enabled: boolean;
  executable: boolean;
  reason: string | null;
  skillId: string | null;
  status: "blocked" | "implemented" | "planned";
};

export type BrainAgentRuntimeSummary = {
  available: boolean;
  budget: {
    maxCostUsd: number;
    maxDurationSeconds: number;
    maxTokens: number;
  };
  capabilityCount: number;
  capabilities: AgentCapabilitySummary[];
  executableCapabilityCount: number;
  id: BrainAgentId;
  module: string;
  name: string;
  limits: {
    maxConcurrentTasks: number;
    maxDelegationDepth: number;
  };
  plannedCapabilityCount: number;
  reason: string | null;
  requiredPermissions: string[];
  successCriteria: string[];
  version: string;
};

function summarizeAgentCapability(
  tenant: TenantContext,
  capabilityId: string,
  availableSkillIds: Set<string>,
): AgentCapabilitySummary {
  const capability = capabilityRegistry.get(capabilityId);

  if (!capability) {
    return {
      capabilityId,
      enabled: false,
      executable: false,
      reason: "La capability no existe en el catalogo.",
      skillId: null,
      status: "blocked",
    };
  }

  const binding = capabilityRegistry.getImplementedBinding(capability.id);
  const skill = binding ? businessSkillRegistry.get(binding.skillId) : null;
  const hasPermissions = capability.requiredPermissions.every((permission) =>
    tenant.permissions.includes(permission),
  );

  if (!binding || !skill) {
    return {
      capabilityId,
      enabled: capability.enabled,
      executable: false,
      reason: "Capability planificada; aun no tiene Skill ejecutable.",
      skillId: binding?.skillId ?? null,
      status: capability.status,
    };
  }

  if (!capability.enabled || !skill.enabled) {
    return {
      capabilityId,
      enabled: false,
      executable: false,
      reason: "Capability o Skill deshabilitada.",
      skillId: skill.id,
      status: capability.status,
    };
  }

  if (!hasPermissions || !availableSkillIds.has(skill.id)) {
    return {
      capabilityId,
      enabled: capability.enabled,
      executable: false,
      reason: "No disponible por permisos, plan o modulo activo.",
      skillId: skill.id,
      status: capability.status,
    };
  }

  return {
    capabilityId,
    enabled: true,
    executable: true,
    reason: null,
    skillId: skill.id,
    status: capability.status,
  };
}

export function listBrainAgentsForTenant(
  tenant: TenantContext,
): BrainAgentRuntimeSummary[] {
  const activeModules = new Set(tenant.activeModules);
  const permissions = new Set(tenant.permissions);
  const availableSkillIds = new Set(
    businessSkillRegistry.getAvailable(tenant).map((skill) => skill.id),
  );

  return initialBrainAgents.map((agent) => {
    const moduleAvailable = activeModules.has(agent.module);
    const permissionsAvailable = agent.requiredPermissions.every((permission) =>
      permissions.has(permission),
    );
    const capabilities = agent.capabilityIds.map((capabilityId) =>
      summarizeAgentCapability(tenant, capabilityId, availableSkillIds),
    );
    const executableCapabilityCount = capabilities.filter(
      (capability) => capability.executable,
    ).length;
    const plannedCapabilityCount = capabilities.filter(
      (capability) => capability.status === "planned",
    ).length;
    const reason = !moduleAvailable
      ? "Modulo del agente inactivo para esta empresa."
      : !permissionsAvailable
        ? "Permisos base del agente incompletos."
        : executableCapabilityCount === 0
          ? "El agente no tiene capabilities ejecutables disponibles."
          : null;

    return {
      available: moduleAvailable && permissionsAvailable && executableCapabilityCount > 0,
      budget: agent.budget,
      capabilityCount: capabilities.length,
      capabilities,
      executableCapabilityCount,
      id: agent.id,
      module: agent.module,
      name: agent.name,
      limits: agent.limits,
      plannedCapabilityCount,
      reason,
      requiredPermissions: agent.requiredPermissions,
      successCriteria: agent.successCriteria,
      version: agent.version,
    };
  });
}
