import "server-only";

import { isStepCount, tool, ToolLoopAgent, type ToolSet } from "ai";

import { resolveBrainLanguageModel } from "@/modules/brain/providers/model-router";
import { initialBrainAgents } from "@/modules/brain/runtime/orchestration-catalog";
import { requiresBrainApproval } from "@/modules/brain/runtime/policy-engine";
import { toSafeToolName } from "@/modules/brain/runtime/skill-search";
import {
  brainRuntime,
  businessSkillRegistry,
  capabilityRegistry,
} from "@/modules/brain/runtime/default-runtime";
import type { BrainAgentId } from "@/modules/brain/runtime/contracts";
import type { JsonRecord, TenantContext } from "@/types/core";

export async function runSpecializedBrainAgent(input: {
  agentId: BrainAgentId;
  dependencyOutputs?: Record<string, unknown>;
  objective: string;
  runId: string;
  taskId: string;
  tenant: TenantContext;
}) {
  const definition = initialBrainAgents.find((agent) => agent.id === input.agentId);
  if (!definition) throw new Error("El agente especializado no existe.");
  if (
    !input.tenant.activeModules.includes(definition.module) ||
    !definition.requiredPermissions.every((permission) => input.tenant.permissions.includes(permission))
  ) {
    throw new Error(`El agente ${definition.name} no esta autorizado para este usuario.`);
  }

  const allowedSkillIds = new Set(
    definition.capabilityIds.flatMap((capabilityId) => {
      const binding = capabilityRegistry.getImplementedBinding(capabilityId);
      return binding ? [binding.skillId] : [];
    }),
  );
  const allowedSkills = businessSkillRegistry
    .getAvailable(input.tenant)
    .filter((skill) => allowedSkillIds.has(skill.id))
    .filter((skill) => !requiresBrainApproval(skill));
  const tools: ToolSet = {};

  for (const skill of allowedSkills.slice(0, 40)) {
    const toolName = toSafeToolName(skill.id);
    tools[toolName] = tool({
      description: `${skill.name}. ${skill.description}`,
      inputSchema: skill.inputSchema,
      execute: async (toolInput, { toolCallId }) => {
        const result = await brainRuntime.invoke({
          idempotencyKey: skill.idempotency === "required"
            ? `${input.runId}:${input.taskId}:${toolCallId}`
            : undefined,
          input: toolInput as JsonRecord,
          skillId: skill.id,
          source: {
            audience: "agent",
            channel: "agent",
            correlationId: input.runId,
            module: skill.module,
            surface: `brain.team.${input.taskId}`,
          },
          tenant: input.tenant,
        });
        return result.ok
          ? {
              data: result.data.data,
              evidence: result.data.evidence,
              links: result.data.links,
              message: result.data.message,
              ok: true,
            }
          : { error: result.error.message, ok: false };
      },
    });
  }

  const { model, modelId, routing } = await resolveBrainLanguageModel({
    message: input.objective,
    requestedTeam: true,
    selectedSkillCount: allowedSkills.length,
  });
  const agent = new ToolLoopAgent({
    id: `biz-brain-agent-${definition.id}`,
    instructions: [
      `Eres ${definition.name}, miembro acotado de un equipo dirigido por Brain Supervisor.`,
      ...definition.instructions,
      `Criterios de exito: ${definition.successCriteria.join(" ")}`,
      "No puedes delegar en otros agentes ni ejecutar herramientas que pidan aprobacion.",
      "Responde en espanol con hallazgos, evidencia, enlaces y pendientes concretos.",
    ].join("\n"),
    maxOutputTokens: Math.min(definition.budget.maxTokens, 8_000),
    maxRetries: 2,
    model,
    stopWhen: isStepCount(8),
    temperature: 0.15,
    tools,
  });
  const result = await agent.generate({
    prompt: [
      `Objetivo asignado: ${input.objective}`,
      input.dependencyOutputs && Object.keys(input.dependencyOutputs).length > 0
        ? `Resultados de dependencias: ${JSON.stringify(input.dependencyOutputs).slice(0, 12_000)}`
        : "No hay resultados previos.",
    ].join("\n\n"),
  });

  return {
    agentId: definition.id,
    evidence: result.steps.flatMap((step) =>
      step.toolResults.map((toolResult) => ({
        output: toolResult.output,
        toolName: toolResult.toolName,
      })),
    ),
    model: modelId,
    routing,
    text: result.text,
    usage: result.totalUsage,
  };
}
