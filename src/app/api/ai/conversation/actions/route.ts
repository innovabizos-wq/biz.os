import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { listConversationActionsForTenant } from "@/lib/ai/action-registry";
import {
  businessSkillRegistry,
  capabilityRegistry,
  initialBrainAgents,
  initialBrainAutomationJobs,
  initialBrainTaskSuccessMetrics,
  initialBrainWorkflows,
} from "@/modules/brain/runtime";

async function getTenantOrResponse() {
  const tenant = await getCurrentTenantContext();

  if (!tenant.ok) {
    return { response: NextResponse.json({ error: tenant.error.message }, { status: 401 }) };
  }

  if (!tenant.data) {
    return { response: NextResponse.json({ error: "Tenant no configurado." }, { status: 401 }) };
  }

  return { tenant: tenant.data };
}

export async function GET() {
  const context = await getTenantOrResponse();
  if ("response" in context) return context.response;
  const availableSkills = businessSkillRegistry.getAvailable(context.tenant);
  const availableSkillIds = new Set(availableSkills.map((skill) => skill.id));

  return NextResponse.json({
    actions: listConversationActionsForTenant(context.tenant),
    agents: initialBrainAgents,
    automationJobs: initialBrainAutomationJobs,
    capabilities: capabilityRegistry
      .list()
      .filter((capability) =>
        capability.skillBindings.some((binding) =>
          availableSkillIds.has(binding.skillId),
        ),
      )
      .map((capability) => ({
        description: capability.description,
        id: capability.id,
        kind: capability.kind,
        module: capability.module,
        name: capability.name,
        requiredPermissions: capability.requiredPermissions,
        status: capability.status,
        version: capability.version,
      })),
    skills: availableSkills.map((skill) => ({
      description: skill.description,
      id: skill.id,
      kind: skill.kind,
      legacyActionId: skill.legacyActionId ?? null,
      module: skill.module,
      name: skill.name,
      requiresConfirmation: skill.requiresConfirmation,
      risk: skill.risk,
      version: skill.version,
    })),
    taskSuccessMetrics: initialBrainTaskSuccessMetrics,
    workflows: initialBrainWorkflows,
  });
}
