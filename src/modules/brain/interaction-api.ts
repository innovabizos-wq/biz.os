import "server-only";

import { randomUUID } from "node:crypto";

import type { UIMessage } from "ai";

import { resolveBrainLanguageModel } from "@/modules/brain/providers/model-router";
import { createCentralBrainAgent } from "@/modules/brain/runtime/brain-agent";
import {
  appendBrainRunEvent,
  createBrainConversationRun,
  getOrCreateBrainConversation,
  saveBrainMessages,
  updateBrainRun,
} from "@/modules/brain/runtime/conversation-repository";
import {
  brainRuntime,
  businessSkillRegistry,
  capabilityRegistry,
} from "@/modules/brain/runtime/default-runtime";
import { rankBusinessSkills } from "@/modules/brain/runtime/skill-search";
import { decideBrainExecutionMode } from "@/modules/brain/runtime/supervisor";
import { startBrainTeam } from "@/modules/brain/team-service";
import type { BrainAgentId, BrainSourceContext } from "@/modules/brain/runtime/contracts";
import type { JsonRecord, TenantContext } from "@/types/core";

export async function askBrain(input: {
  conversationId?: string;
  currentModule?: string | null;
  currentPath?: string | null;
  message: string;
  source?: Partial<BrainSourceContext>;
  tenant: TenantContext;
}) {
  const conversationId = input.conversationId ?? randomUUID();
  await getOrCreateBrainConversation({
    channel: "api",
    conversationId,
    currentPath: input.currentPath,
    tenant: input.tenant,
  });
  const message: UIMessage = {
    id: randomUUID(),
    parts: [{ text: input.message, type: "text" }],
    role: "user",
  };
  await saveBrainMessages({ conversationId, messages: [message], tenant: input.tenant });
  const runId = await createBrainConversationRun({ channel: "api", conversationId, message, tenant: input.tenant });
  try {
    const { model, modelId, routing, settings } = await resolveBrainLanguageModel({
      currentModule: input.currentModule,
      message: input.message,
    });
    const { agent, selectedSkillIds } = await createCentralBrainAgent({
      conversationId,
      currentModule: input.currentModule,
      currentPath: input.currentPath,
      entity: input.source?.entity,
      message: input.message,
      model,
      runId,
      selection: input.source?.selection,
      settings,
      tenant: input.tenant,
      timezone: input.source?.timezone,
    });
    const result = await agent.generate({ prompt: input.message });
    const assistantMessage: UIMessage = {
      id: randomUUID(),
      parts: [{ text: result.text, type: "text" }],
      role: "assistant",
    };
    await Promise.all([
      saveBrainMessages({ conversationId, messages: [assistantMessage], tenant: input.tenant }),
      updateBrainRun({ response: { text: result.text }, runId, status: "completed", tenant: input.tenant }),
      appendBrainRunEvent(input.tenant, runId, "run.completed", { modelId, routing, selectedSkillIds }),
    ]);
    return {
      conversationId,
      modelId,
      routing,
      runId,
      text: result.text,
      usage: result.totalUsage,
    };
  } catch (error) {
    await updateBrainRun({ response: { error: error instanceof Error ? error.message : "Error desconocido" }, runId, status: "failed", tenant: input.tenant });
    throw error;
  }
}

export function suggestBrainCapabilities(input: {
  currentModule?: string | null;
  limit?: number;
  message: string;
  tenant: TenantContext;
}) {
  return rankBusinessSkills({
    currentModule: input.currentModule,
    limit: input.limit ?? 12,
    message: input.message,
    skills: businessSkillRegistry.getAvailable(input.tenant),
  }).map((skill) => ({
    description: skill.description,
    id: skill.id,
    kind: skill.kind,
    module: skill.module,
    name: skill.name,
    requiresConfirmation: skill.requiresConfirmation,
    risk: skill.risk,
  }));
}

export async function invokeBrainCapability(input: {
  approval?: { confirmed: boolean; reference?: string };
  capabilityId: string;
  idempotencyKey?: string;
  skillInput?: JsonRecord;
  source?: Partial<BrainSourceContext>;
  tenant: TenantContext;
}) {
  const binding = capabilityRegistry.getImplementedBinding(input.capabilityId);
  if (!binding) throw new Error("La capacidad no tiene una habilidad implementada.");
  return brainRuntime.invoke({
    approval: input.approval,
    idempotencyKey: input.idempotencyKey,
    input: input.skillInput ?? {},
    skillId: binding.skillId,
    source: {
      audience: input.source?.audience ?? "internal",
      channel: input.source?.channel ?? "api",
      correlationId: input.source?.correlationId,
      entity: input.source?.entity,
      module: input.source?.module,
      selection: input.source?.selection,
      surface: input.source?.surface ?? "brain.internal-api",
      timezone: input.source?.timezone,
    },
    tenant: input.tenant,
  });
}

export async function startBrainRun(input: {
  capabilityId?: string;
  maxConcurrency?: number;
  objective: string;
  requestedAgents?: BrainAgentId[];
  requestedTeam?: boolean;
  skillInput?: JsonRecord;
  tenant: TenantContext;
}) {
  const decision = decideBrainExecutionMode({ objective: input.objective, requestedTeam: input.requestedTeam });
  if (decision.mode === "team" || decision.mode === "agent") {
    const result = await startBrainTeam({
      maxConcurrency: input.maxConcurrency,
      objective: input.objective,
      requestedAgents: input.requestedAgents,
      tenant: input.tenant,
    });
    return { decision, result };
  }
  if (!input.capabilityId) {
    return { decision, suggestions: suggestBrainCapabilities({ message: input.objective, tenant: input.tenant }) };
  }
  return {
    decision,
    result: await invokeBrainCapability({
      capabilityId: input.capabilityId,
      skillInput: input.skillInput,
      tenant: input.tenant,
    }),
  };
}

export const brain = {
  ask: askBrain,
  invoke: invokeBrainCapability,
  startRun: startBrainRun,
  suggest: suggestBrainCapabilities,
};
