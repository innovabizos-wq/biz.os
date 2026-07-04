import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { hasEveryPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  getConversationAction,
  listConversationActionsForTenant,
  resolveConversationAction,
} from "@/lib/ai/action-registry";
import { parseLocalConversationAction } from "@/modules/ai/conversation-local-parser";
import { interpretBrainMessage, naturalizeBrainResponse } from "@/modules/ai/conversation-layer-service";
import type { ConversationLayerIntent } from "@/modules/ai/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

type ConversationExecutionPayload = {
  actionId?: string;
  brainContext?: Record<string, unknown>;
  confirmationToken?: string;
  context?: Record<string, unknown>;
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
  exp: number;
  params: Record<string, unknown>;
  profileId: string;
  tenantId: string;
};

type ConversationExecutionPreview = {
  actionId: string;
  actionName: string;
  confirmationRequired: boolean;
  expiresAt?: string;
  message: string;
  mode: "dry_run" | "confirmation_required" | "executed";
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
  risk: string;
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

function normalizeParams(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function actionFromIntent(intent: ConversationLayerIntent) {
  return (
    getConversationAction(intent.action_id ?? "") ||
    getConversationAction(intent.action) ||
    resolveConversationAction(intent.action) ||
    resolveConversationAction(intent.intent)
  );
}

async function resolveExecutionIntent(
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
): Promise<CoreResult<{ actionId: string; params: Record<string, unknown> }>> {
  if (payload.actionId) {
    return ok({
      actionId: payload.actionId,
      params: normalizeParams(payload.params),
    });
  }

  const userMessage = payload.userMessage ?? payload.message;
  const local = userMessage
    ? parseLocalConversationAction(userMessage, payload.context)
    : null;

  if (local && local.confidence >= 0.6) {
    return ok({ actionId: local.actionId, params: local.params });
  }

  if (!userMessage) {
    return fail(
      "VALIDATION_ERROR",
      "Envia actionId+params o envia message para que el sistema interprete.",
    );
  }

  const availableActions = listConversationActionsForTenant(tenant).map((action) => ({
    aliases: action.aliases,
    description: action.description,
    id: action.id,
    module: action.module,
    requiredFields: action.requiredFields,
    risk: action.risk,
  }));

  const interpreted = await interpretBrainMessage({
    availableActions: availableActions.map((action) => action.id),
    context: {
      ...(payload.context ?? {}),
      brainContext: payload.brainContext ?? null,
      actionRegistry: availableActions,
      contract:
        "Devuelve action con el action_id exacto cuando el mensaje coincida con una accion disponible.",
      planId: payload.planId ?? null,
      recommendationId: payload.recommendationId ?? null,
      target: payload.target ?? "action",
    },
    module: payload.module ?? "global",
    requiredFields: {},
    userMessage,
  });

  if (!interpreted.ok) {
    return fail("MODULE_MISCONFIGURED", interpreted.error.message, interpreted.error);
  }

  const action = actionFromIntent(interpreted.data);
  if (!action) {
    return fail(
      "VALIDATION_ERROR",
      interpreted.data.reply_to_user || "No pude relacionar el mensaje con una accion disponible.",
      interpreted.data,
    );
  }

  return ok({ actionId: action.id, params: normalizeParams(interpreted.data.data) });
}

function validateTenantAction(tenant: TenantContext, actionId: string) {
  const action = getConversationAction(actionId);
  if (!action) {
    return fail("VALIDATION_ERROR", "La accion conversacional no existe.");
  }

  if (action.module !== "dashboard" && !tenant.activeModules.includes(action.module)) {
    return fail("MODULE_INACTIVE", `El modulo ${action.module} no esta activo.`);
  }

  if (!hasEveryPermission(tenant.permissions, action.requiredPermissions)) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ejecutar esta accion.");
  }

  return ok(action);
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

export async function dryRunConversationExecution(
  tenant: TenantContext,
  payload: ConversationExecutionPayload,
): Promise<CoreResult<ConversationExecutionPreview>> {
  const resolved = await resolveExecutionIntent(tenant, payload);
  if (!resolved.ok) return resolved;

  const actionResult = validateTenantAction(tenant, resolved.data.actionId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  const parsed = action.schema.safeParse(resolved.data.params);

  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Faltan datos o hay datos invalidos.", parsed.error.flatten());
  }

  const params = parsed.data as Record<string, unknown>;
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS);
  const token = action.requiresConfirmation
    ? createConfirmationToken({
        actionId: action.id,
        exp: expiresAt.getTime(),
        params,
        profileId: tenant.profileId,
        tenantId: tenant.empresaId,
      })
    : undefined;

  const preview: ConversationExecutionPreview = {
    actionId: action.id,
    actionName: action.name,
    confirmationRequired: action.requiresConfirmation,
    expiresAt: token ? expiresAt.toISOString() : undefined,
    message: action.requiresConfirmation
      ? `Listo para ejecutar: ${action.name}. Necesita confirmacion.`
      : `Listo para ejecutar: ${action.name}.`,
    mode: action.requiresConfirmation ? "confirmation_required" : "dry_run",
    params,
    risk: action.risk,
    token,
  };

  await auditConversationAction(tenant, {
    actionId: action.id,
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

  const action = getConversationAction(dryRun.data.actionId);
  if (!action) return fail("VALIDATION_ERROR", "La accion conversacional no existe.");

  if (action.requiresConfirmation) {
    return ok({
      ...dryRun.data,
      mode: "confirmation_required",
      message: `Necesito confirmacion antes de ejecutar: ${action.name}.`,
    });
  }

  try {
    const result = await action.handler(dryRun.data.params, { tenant });
    await auditConversationAction(tenant, {
      actionId: action.id,
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
      actionId: action.id,
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

  const actionResult = validateTenantAction(tenant, confirmation.actionId);
  if (!actionResult.ok) return actionResult;

  const action = actionResult.data;
  const parsed = action.schema.safeParse(confirmation.params);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "La confirmacion contiene datos invalidos.", parsed.error.flatten());
  }

  try {
    const result = await action.handler(parsed.data, { tenant });
    const technicalResponse = {
      actionId: action.id,
      message: result.message,
      result: result.result,
    };
    const naturalized = await naturalizeBrainResponse({
      module: String(action.module),
      technicalResponse,
      userOriginalMessage: action.name,
    });

    await auditConversationAction(tenant, {
      actionId: action.id,
      entityId: result.entityId,
      mode: "confirm",
      params: confirmation.params,
      result: result.result,
      status: "confirmed",
    });

    return ok({
      actionId: action.id,
      actionName: action.name,
      confirmationRequired: false,
      message: naturalized.ok ? naturalized.data.message : result.message,
      mode: "executed",
      params: confirmation.params,
      result: result.result,
      risk: action.risk,
    });
  } catch (error) {
    await auditConversationAction(tenant, {
      actionId: action.id,
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
