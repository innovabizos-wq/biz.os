import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import {
  getConversationAction,
} from "@/lib/ai/action-registry";
import {
  interpretBrainMessage,
  naturalizeBrainResponse,
} from "@/modules/ai/conversation-layer-service";
import {
  brainRuntime,
  businessIntentRegistry,
  businessIntentResolver,
  businessSkillRegistry,
  capabilityRegistry,
  contextBuilder,
} from "@/modules/brain/runtime";
import {
  isClarificationResult,
  validateIntentSlots,
} from "@/modules/brain/runtime/slot-validator";
import { enrichIntentEntitiesFromMemory } from "@/modules/brain/runtime/conversation-memory";
import { prepareBrainWorkflow } from "@/modules/brain/workflow-service";
import { resolveBrainWorkflowIntent } from "@/modules/brain/workflow-intent";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";
import type {
  BusinessSkillDefinition,
  ContextBuilderResult,
} from "@/modules/brain/runtime/contracts";

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

type ConversationExecutionPayload = {
  actionId?: string;
  brainContext?: Record<string, unknown>;
  confirmationToken?: string;
  context?: Record<string, unknown>;
  idempotencyKey?: string;
  message?: string;
  module?: string;
  params?: Record<string, unknown>;
  planId?: string;
  recommendationId?: string;
  source?: string;
  target?: "action" | "brain";
  userMessage?: string;
};

type ConfirmationPayload = {
  actionId: string;
  approvalId: string;
  context?: ContextBuilderResult;
  exp: number;
  idempotencyKey?: string;
  params: Record<string, unknown>;
  profileId: string;
  skillId?: string;
  skillVersion: string;
  tenantId: string;
  proposalHash: string;
};

type ConversationExecutionPreview = {
  actionId: string;
  actionName: string;
  confirmationRequired: boolean;
  context?: ContextBuilderResult;
  expiresAt?: string;
  idempotencyKey?: string;
  message: string;
  mode: "dry_run" | "confirmation_required" | "executed";
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  risk: string;
  skillId: string;
  token?: string;
};

function getConfirmationSecret() {
  return (
    process.env.AI_ACTION_CONFIRMATION_SECRET ||
    process.env.AI_SETTINGS_ENCRYPTION_KEY ||
    process.env.FISCAL_CONFIG_ENCRYPTION_KEY ||
    (process.env.NODE_ENV !== "production"
      ? "biz.os-local-development-ai-action-confirmation-secret"
      : "")
  );
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  const secret = getConfirmationSecret();
  if (!secret) throw new Error("Falta AI_ACTION_CONFIRMATION_SECRET en el servidor.");

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createConfirmationToken(payload: ConfirmationPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function readConfirmationToken(token: string): ConfirmationPayload {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("Token de confirmacion invalido.");

  const expected = sign(body);
  const valid =
    expected.length === signature.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature));

  if (!valid) throw new Error("Token de confirmacion invalido.");

  const parsed = JSON.parse(base64UrlDecode(body)) as ConfirmationPayload;
  if (parsed.exp < Date.now()) throw new Error("La confirmacion expiro.");

  return parsed;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hashProposal(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function normalizeParams(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isTerminalIntentError(error: CoreResult<unknown>["error"]) {
  return Boolean(
    error?.cause &&
      typeof error.cause === "object" &&
      "terminal" in error.cause &&
      error.cause.terminal === true,
  );
}

function sourceFromPayload(
  payload: ConversationExecutionPayload,
  module: BusinessSkillDefinition["module"],
) {
  return {
    channel:
      payload.source === "global_command_bar"
        ? "bar"
        : payload.source === "brain"
          ? "brain"
          : "api",
    module,
    surface: payload.source ?? "conversation_execution_bridge",
  } as const;
}

async function buildContextForSkill(
  tenant: TenantContext,
  skill: BusinessSkillDefinition,
  params: Record<string, unknown>,
  payload: ConversationExecutionPayload,
) {
  const capability = capabilityRegistry
    .list()
    .find((candidate) =>
      candidate.skillBindings.some((binding) => binding.skillId === skill.id),
    );

  if (!capability) return undefined;

  const result = await contextBuilder.build({
    capabilityId: capability.id,
    entities: params,
    intentId: capability.id,
    source: sourceFromPayload(payload, skill.module),
    tenant,
  });

  return result.ok ? result.data : undefined;
}

async function resolveExecutionIntent(
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
): Promise<CoreResult<{
  context?: ContextBuilderResult;
  params: Record<string, unknown>;
  skillId: string;
}>> {
  if (payload.actionId) {
    const skill =
      businessSkillRegistry.getByLegacyActionId(payload.actionId) ??
      businessSkillRegistry.get(payload.actionId);

    if (!skill) {
      return fail(
        "VALIDATION_ERROR",
        "La accion o Business Skill conversacional no existe.",
      );
    }

    return ok({
      context: await buildContextForSkill(
        tenant,
        skill,
        normalizeParams(payload.params),
        payload,
      ),
      params: normalizeParams(payload.params),
      skillId: skill.id,
    });
  }

  const userMessage = payload.userMessage ?? payload.message;
  if (!userMessage) {
    return fail(
      "VALIDATION_ERROR",
      "Envia actionId+params o envia message para que el sistema interprete.",
    );
  }

  let resolvedIntent = businessIntentResolver.resolve({
    context: payload.context,
    message: userMessage,
  });

  if (!resolvedIntent.ok && isTerminalIntentError(resolvedIntent.error)) {
    return resolvedIntent;
  }

  if (!resolvedIntent.ok) {
    const availableIntents = businessIntentRegistry.list().map((intent) => ({
      capabilityId: intent.capabilityId,
      description: intent.description,
      examples: intent.examples,
      id: intent.id,
      module: intent.module,
      requiredSlots: intent.requiredSlots.map((slot) => slot.name),
    }));
    const interpreted = await interpretBrainMessage({
      availableActions: availableIntents.map((intent) => intent.id),
      context: {
        ...(payload.context ?? {}),
        brainContext: payload.brainContext ?? null,
        contract:
          "Devuelve action_id con el Business Intent exacto. No devuelvas Skill IDs. No inventes datos que no esten en el mensaje.",
        intentRegistry: availableIntents,
        planId: payload.planId ?? null,
        recommendationId: payload.recommendationId ?? null,
        target: "business_intent",
      },
      module: payload.module ?? "global",
      requiredFields: {},
      userMessage,
    });

    if (!interpreted.ok) return resolvedIntent;

    const intentId =
      interpreted.data.action_id ||
      interpreted.data.action ||
      interpreted.data.intent;
    const intent = businessIntentRegistry.get(intentId);
    if (!intent) return resolvedIntent;

    resolvedIntent = ok({
      capabilityId: intent.capabilityId,
      confidence: interpreted.data.confidence ?? 0.7,
      entities: normalizeParams(interpreted.data.data),
      intentId: intent.id,
      source: "llm",
    });
  }

  if (!resolvedIntent.ok) return resolvedIntent;

  const intentResolution = resolvedIntent.data;
  const intent = businessIntentRegistry.get(intentResolution.intentId);
  if (!intent) {
    return fail(
      "MODULE_MISCONFIGURED",
      `La intencion ${intentResolution.intentId} no esta registrada.`,
    );
  }

  const entities = enrichIntentEntitiesFromMemory(
    intent,
    intentResolution.entities,
    payload.context,
  );
  const slotResult = validateIntentSlots(intent, entities);
  if (!slotResult.ok) return slotResult;
  if (isClarificationResult(slotResult.data)) {
    return fail("VALIDATION_ERROR", slotResult.data.message, slotResult.data);
  }

  const contextResult = await contextBuilder.build({
    capabilityId: intentResolution.capabilityId,
    entities: slotResult.data.params,
    intentId: intentResolution.intentId,
    source: {
      ...sourceFromPayload(payload, intent.module),
    },
    tenant,
  });
  if (!contextResult.ok) return contextResult;

  const capability = capabilityRegistry.get(intentResolution.capabilityId);
  if (!capability) {
    return fail(
      "MODULE_MISCONFIGURED",
      `La capability ${intentResolution.capabilityId} no esta registrada.`,
    );
  }

  const binding = capabilityRegistry.getImplementedBinding(capability.id);
  if (!binding) {
    return fail(
      "PLAN_FEATURE_UNAVAILABLE",
      `La capacidad ${capability.name} esta planificada, pero todavia no tiene una Skill implementada para ejecutarla.`,
      { capabilityId: capability.id, intentId: intent.id },
    );
  }

  const skill = businessSkillRegistry.get(binding.skillId);
  if (!skill) {
    return fail(
      "MODULE_MISCONFIGURED",
      `La Skill ${binding.skillId} no esta registrada para ejecutarse.`,
    );
  }

  return ok({
    context: contextResult.data,
    params: slotResult.data.params,
    skillId: skill.id,
  });
}

function describeSkill(skill: BusinessSkillDefinition) {
  const legacyAction = skill.legacyActionId
    ? getConversationAction(skill.legacyActionId)
    : null;

  return {
    actionId: legacyAction?.id ?? skill.id,
    name: legacyAction?.name ?? skill.name,
    risk: legacyAction?.risk ?? skill.risk,
  };
}

async function auditConversationAction(
  tenant: TenantContext,
  input: {
    actionId: string;
    entityId?: string | null;
    mode: string;
    originalMessage?: string | null;
    planId?: string | null;
    params: Record<string, unknown>;
    recommendationId?: string | null;
    result?: Record<string, unknown>;
    source?: string | null;
    status: "blocked" | "confirmed" | "dry_run" | "executed" | "failed";
    target?: string | null;
  },
) {
  const supabase = await createClient();
  await supabase.from("auditoria_eventos").insert({
    accion: `ai_conversation.${input.status}`,
    datos_antes: null,
    datos_despues: (input.result ?? {}) as JsonRecord,
    empresa_id: tenant.empresaId,
    entidad: "conversation_action",
    entidad_id: input.entityId ?? null,
    ip: null,
    metadata: {
      actionId: input.actionId,
      originalMessage: input.originalMessage ?? null,
      mode: input.mode,
      params: input.params,
      planId: input.planId ?? null,
      recommendationId: input.recommendationId ?? null,
      source: input.source ?? "conversation_execution_bridge",
      target: input.target ?? "action",
    } satisfies JsonRecord,
    sucursal_id: tenant.sucursalId ?? null,
    user_agent: null,
    usuario_id: tenant.profileId,
  });
}

async function executeSkillImplementation(
  skill: BusinessSkillDefinition,
  params: Record<string, unknown>,
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
  options?: {
    confirmed?: boolean;
    confirmationReference?: string;
    context?: ContextBuilderResult;
    idempotencyKey?: string;
  },
) {
  const skillResult = await brainRuntime.invoke({
    approval: options?.confirmed
      ? {
          confirmed: true,
          reference: options.confirmationReference,
        }
      : undefined,
    idempotencyKey: options?.idempotencyKey,
    input: params,
    skillId: skill.id,
    source: {
      ...sourceFromPayload(payload, skill.module),
    },
    tenant,
  });

  if (!skillResult.ok) return skillResult;

  return ok({
    entityId: null,
    message: skillResult.data.message,
    result: {
      ...skillResult.data.data,
      brain: {
        cached: skillResult.data.cached,
        context: options?.context
          ? {
              facts: options.context.facts,
              freshnessAt: options.context.freshnessAt,
            }
          : undefined,
        evidence: [
          ...(options?.context?.evidence ?? []),
          ...skillResult.data.evidence,
        ],
        executedAt: skillResult.data.executedAt,
        invocationId: skillResult.data.invocationId,
        links: skillResult.data.links,
        skillId: skillResult.data.skillId,
      },
    },
  });
}

export async function dryRunConversationExecution(
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
): Promise<CoreResult<ConversationExecutionPreview>> {
  const workflowMessage = payload.userMessage ?? payload.message;
  const workflowIntent = workflowMessage
    ? resolveBrainWorkflowIntent(workflowMessage)
    : null;

  if (workflowIntent) {
    const plan = await prepareBrainWorkflow(tenant, {
      id: payload.planId,
      inputsByStep: workflowIntent.inputsByStep,
      workflowId: workflowIntent.workflowId,
    });
    if (!plan.ok) return plan;

    return ok({
      actionId: workflowIntent.workflowId,
      actionName: "Preparar workflow Brain",
      confirmationRequired: false,
      message:
        plan.data.status === "pending_approval"
          ? "Prepare un plan con pasos que requieren aprobacion antes de ejecutarse."
          : "Prepare un plan de workflow para revisar antes de ejecutar.",
      mode: "dry_run",
      params: {
        inputsByStep: workflowIntent.inputsByStep,
        workflowId: workflowIntent.workflowId,
      },
      result: {
        brainWorkflow: plan.data,
        confidence: workflowIntent.confidence,
      },
      risk: "medium",
      skillId: "brain.workflow.prepare",
    });
  }

  const resolved = await resolveExecutionIntent(tenant, payload);
  if (!resolved.ok) return resolved;

  const skill = businessSkillRegistry.get(resolved.data.skillId);
  if (!skill) {
    return fail(
      "MODULE_MISCONFIGURED",
      `La Business Skill ${resolved.data.skillId} no esta registrada.`,
    );
  }
  const action = describeSkill(skill);

  const parsed = skill.inputSchema.safeParse(resolved.data.params);

  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message || "Faltan datos o hay datos invalidos.",
      parsed.error.flatten(),
    );
  }

  const params = parsed.data as Record<string, unknown>;
  const idempotencyKey =
    skill.idempotency === "required"
      ? payload.idempotencyKey?.trim() || randomUUID()
      : undefined;
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);
  let token: string | undefined;
  if (skill.requiresConfirmation) {
    const approvalId = randomUUID();
    const proposal = {
      actionId: action.actionId,
      context: resolved.data.context,
      idempotencyKey: idempotencyKey ?? randomUUID(),
      params,
      skillId: skill.id,
      skillVersion: skill.version,
    };
    const proposalHash = hashProposal(proposal);
    const supabase = await createClient();
    const { error: approvalError } = await supabase.from("brain_approvals").insert({
      approval_id: approvalId,
      empresa_id: tenant.empresaId,
      expires_at: expiresAt.toISOString(),
      idempotency_key: proposal.idempotencyKey,
      proposal_hash: proposalHash,
      proposal_version: skill.version,
      request: proposal,
      requested_by: tenant.profileId,
      risk: skill.risk,
      status: "pending",
      tool_name: skill.id,
    });
    if (approvalError) {
      return fail(
        "VALIDATION_ERROR",
        "No se pudo registrar la aprobación requerida.",
        approvalError,
      );
    }
    token = createConfirmationToken({
      actionId: action.actionId,
      approvalId,
      context: resolved.data.context,
      exp: expiresAt.getTime(),
      idempotencyKey: proposal.idempotencyKey,
      params,
      profileId: tenant.profileId,
      proposalHash,
      skillId: skill.id,
      skillVersion: skill.version,
      tenantId: tenant.empresaId,
    });
  }

  const preview: ConversationExecutionPreview = {
    actionId: action.actionId,
    actionName: action.name,
    confirmationRequired: skill.requiresConfirmation,
    context: resolved.data.context,
    expiresAt: token ? expiresAt.toISOString() : undefined,
    idempotencyKey,
    message: skill.requiresConfirmation
      ? `Listo para ejecutar: ${action.name}. Necesita confirmacion.`
      : `Listo para ejecutar: ${action.name}.`,
    mode: skill.requiresConfirmation ? "confirmation_required" : "dry_run",
    params,
    risk: action.risk,
    skillId: skill.id,
    token,
  };

  await auditConversationAction(tenant, {
    actionId: action.actionId,
    mode: "dry_run",
    originalMessage: payload.userMessage ?? payload.message ?? null,
    planId: payload.planId ?? null,
    params,
    recommendationId: payload.recommendationId ?? null,
    source: payload.source,
    status: "dry_run",
    target: payload.target ?? null,
  });

  return ok(preview);
}

export async function executeConversationExecution(
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
): Promise<CoreResult<ConversationExecutionPreview>> {
  const dryRun = await dryRunConversationExecution(tenant, payload);
  if (!dryRun.ok) return dryRun;
  if (dryRun.data.skillId === "brain.workflow.prepare") {
    return ok(dryRun.data);
  }

  const skill =
    businessSkillRegistry.get(dryRun.data.skillId) ??
    businessSkillRegistry.getByLegacyActionId(dryRun.data.actionId) ??
    businessSkillRegistry.get(dryRun.data.actionId);
  if (!skill) {
    return fail(
      "MODULE_MISCONFIGURED",
      `La Business Skill ${dryRun.data.actionId} no esta registrada.`,
    );
  }
  const action = describeSkill(skill);

  if (skill.requiresConfirmation) {
    return ok({
      ...dryRun.data,
      mode: "confirmation_required",
      message: `Necesito confirmacion antes de ejecutar: ${action.name}.`,
    });
  }

  try {
    const execution = await executeSkillImplementation(
      skill,
      dryRun.data.params,
      tenant,
      payload,
      {
        context: dryRun.data.context,
        idempotencyKey: dryRun.data.idempotencyKey,
      },
    );
    if (!execution.ok) {
      await auditConversationAction(tenant, {
        actionId: action.actionId,
        mode: "execute",
        originalMessage: payload.userMessage ?? payload.message ?? null,
        planId: payload.planId ?? null,
        params: dryRun.data.params,
        recommendationId: payload.recommendationId ?? null,
        result: { error: execution.error.message },
        source: payload.source,
        status: "failed",
        target: payload.target ?? null,
      });
      return execution;
    }

    const result = execution.data;
    await auditConversationAction(tenant, {
      actionId: action.actionId,
      entityId: result.entityId,
      mode: "execute",
      originalMessage: payload.userMessage ?? payload.message ?? null,
      planId: payload.planId ?? null,
      params: dryRun.data.params,
      recommendationId: payload.recommendationId ?? null,
      result: result.result,
      source: payload.source,
      status: "executed",
      target: payload.target ?? null,
    });

    return ok({
      ...dryRun.data,
      confirmationRequired: false,
      message: result.message,
      mode: "executed",
      result: result.result,
    });
  } catch (error) {
    await auditConversationAction(tenant, {
      actionId: action.actionId,
      mode: "execute",
      originalMessage: payload.userMessage ?? payload.message ?? null,
      planId: payload.planId ?? null,
      params: dryRun.data.params,
      recommendationId: payload.recommendationId ?? null,
      result: { error: error instanceof Error ? error.message : "Error desconocido" },
      source: payload.source,
      status: "failed",
      target: payload.target ?? null,
    });
    return fail(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "No se pudo ejecutar la accion.",
      error,
    );
  }
}

export async function confirmConversationExecution(
  tenant: TenantContext,
  token: string,
): Promise<CoreResult<ConversationExecutionPreview>> {
  let confirmation: ConfirmationPayload;

  try {
    confirmation = readConfirmationToken(token);
  } catch (error) {
    return fail(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "Token de confirmacion invalido.",
      error,
    );
  }

  if (confirmation.tenantId !== tenant.empresaId || confirmation.profileId !== tenant.profileId) {
    return fail("PERMISSION_DENIED", "La confirmacion no pertenece a este usuario.");
  }

  const skill =
    (confirmation.skillId ? businessSkillRegistry.get(confirmation.skillId) : null) ??
    businessSkillRegistry.getByLegacyActionId(confirmation.actionId) ??
    businessSkillRegistry.get(confirmation.actionId);
  if (!skill) {
    return fail("VALIDATION_ERROR", "La Business Skill de la confirmacion no existe.");
  }

  const currentProposalHash = hashProposal({
    actionId: confirmation.actionId,
    context: confirmation.context,
    idempotencyKey: confirmation.idempotencyKey,
    params: confirmation.params,
    skillId: confirmation.skillId,
    skillVersion: confirmation.skillVersion,
  });
  if (
    confirmation.skillVersion !== skill.version
    || currentProposalHash !== confirmation.proposalHash
  ) {
    return fail(
      "VALIDATION_ERROR",
      "La propuesta cambió y requiere una aprobación nueva.",
    );
  }

  const supabase = await createClient();
  const { data: approvalAccepted, error: approvalError } = await supabase.rpc(
    "approve_brain_proposal",
    {
      p_approval_id: confirmation.approvalId,
      p_proposal_hash: confirmation.proposalHash,
    },
  );
  if (approvalError || approvalAccepted !== true) {
    return fail(
      "PERMISSION_DENIED",
      "La aprobación no existe, venció o ya fue utilizada.",
      approvalError,
    );
  }

  const action = describeSkill(skill);
  const parsed = skill.inputSchema.safeParse(confirmation.params);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "La confirmacion contiene datos invalidos.", parsed.error.flatten());
  }

  try {
    const execution = await executeSkillImplementation(
      skill,
      parsed.data as Record<string, unknown>,
      tenant,
      { source: "confirmation" },
      {
        confirmed: true,
        confirmationReference: token,
        context: confirmation.context,
        idempotencyKey: confirmation.idempotencyKey ?? randomUUID(),
      },
    );
    if (!execution.ok) return execution;
    const result = execution.data;
    const { data: consumed } = await supabase.rpc("consume_brain_proposal", {
      p_approval_id: confirmation.approvalId,
      p_proposal_hash: confirmation.proposalHash,
    });
    if (consumed !== true) {
      return fail(
        "VALIDATION_ERROR",
        "La acción terminó, pero no se pudo cerrar su aprobación.",
      );
    }
    const technicalResponse = {
      actionId: action.actionId,
      message: result.message,
      result: result.result,
    };
    const naturalized = await naturalizeBrainResponse({
      module: String(skill.module),
      technicalResponse,
      userOriginalMessage: action.name,
    });

    await auditConversationAction(tenant, {
      actionId: action.actionId,
      entityId: result.entityId,
      mode: "confirm",
      params: confirmation.params,
      result: result.result,
      status: "confirmed",
    });

    return ok({
      actionId: action.actionId,
      actionName: action.name,
      confirmationRequired: false,
      context: confirmation.context,
      message: naturalized.ok ? naturalized.data.message : result.message,
      mode: "executed",
      params: confirmation.params,
      result: result.result,
      risk: action.risk,
      skillId: skill.id,
    });
  } catch (error) {
    await auditConversationAction(tenant, {
      actionId: action.actionId,
      mode: "confirm",
      params: confirmation.params,
      result: { error: error instanceof Error ? error.message : "Error desconocido" },
      status: "failed",
    });
    return fail(
      "VALIDATION_ERROR",
      error instanceof Error ? error.message : "No se pudo confirmar la accion.",
      error,
    );
  }
}
