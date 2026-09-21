import "server-only";

import { createHash } from "node:crypto";
import type { UIMessage } from "ai";

import { createClient } from "@/lib/supabase/server";
import type { BusinessSkillRisk } from "@/modules/brain/runtime/contracts";
import type { JsonRecord, TenantContext } from "@/types/core";

type ConversationChannel = "api" | "automation" | "bar" | "brain" | "customer" | "internal";
type RunStatus =
  | "cancelled"
  | "completed"
  | "denied"
  | "failed"
  | "queued"
  | "retrying"
  | "running"
  | "waiting_approval";

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {})) as JsonRecord;
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalJson(entry)]),
  );
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

function approvalProposalHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalJson(value)))
    .digest("hex");
}

function databaseError(scope: string, error: { message?: string } | null) {
  return new Error(
    `${scope}: ${error?.message ?? "La persistencia de Brain no está disponible. Ejecuta la migración 0074."}`,
  );
}

export async function getOrCreateBrainConversation(input: {
  channel: ConversationChannel;
  conversationId: string;
  currentPath?: string | null;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const existing = await supabase
    .from("brain_conversations")
    .select("id")
    .eq("id", input.conversationId)
    .eq("empresa_id", input.tenant.empresaId)
    .eq("profile_id", input.tenant.profileId)
    .maybeSingle<{ id: string }>();

  if (existing.error) throw databaseError("No se pudo abrir la conversación", existing.error);
  if (existing.data) return existing.data.id;

  const inserted = await supabase
    .from("brain_conversations")
    .insert({
      channel: input.channel,
      empresa_id: input.tenant.empresaId,
      id: input.conversationId,
      profile_id: input.tenant.profileId,
      state: { currentPath: input.currentPath ?? null },
    })
    .select("id")
    .single<{ id: string }>();

  if (inserted.error || !inserted.data) {
    throw databaseError("No se pudo crear la conversación", inserted.error);
  }
  return inserted.data.id;
}

export async function loadBrainMessages(
  tenant: TenantContext,
  conversationId: string,
): Promise<UIMessage[]> {
  const supabase = await createClient();
  const result = await supabase
    .from("brain_messages")
    .select("content")
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId)
    .eq("conversation_id", conversationId)
    .order("sequence", { ascending: true })
    .limit(200);

  if (result.error) throw databaseError("No se pudo cargar el historial", result.error);
  return (result.data ?? []).map((row) => row.content as unknown as UIMessage);
}

export async function saveBrainMessages(input: {
  conversationId: string;
  messages: UIMessage[];
  tenant: TenantContext;
}) {
  if (input.messages.length === 0) return;
  const supabase = await createClient();
  // AI SDK can return the conversation history plus the incoming message on
  // finish. Collapse repeated ids before upserting; Postgres rejects a single
  // upsert statement that targets the same unique row more than once.
  const messagesById = new Map<string, UIMessage>();
  for (const message of input.messages) messagesById.set(message.id, message);
  const rows = [...messagesById.values()].map((message) => ({
    content: asJson(message),
    conversation_id: input.conversationId,
    empresa_id: input.tenant.empresaId,
    message_id: message.id,
    profile_id: input.tenant.profileId,
    role: message.role,
  }));
  const result = await supabase
    .from("brain_messages")
    .upsert(rows, { onConflict: "conversation_id,message_id" });
  if (result.error) throw databaseError("No se pudo guardar el historial", result.error);

  await supabase
    .from("brain_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", input.conversationId)
    .eq("empresa_id", input.tenant.empresaId);
}

export async function createBrainConversationRun(input: {
  channel: ConversationChannel;
  conversationId: string;
  message: UIMessage;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const result = await supabase
    .from("brain_runs")
    .insert({
      conversation_id: input.conversationId,
      empresa_id: input.tenant.empresaId,
      initiated_by: input.tenant.profileId,
      kind: "conversation",
      request: asJson(input.message),
      source: input.channel === "internal" ? "brain" : input.channel,
      status: "running",
    })
    .select("id")
    .single<{ id: string }>();
  if (result.error || !result.data) throw databaseError("No se pudo crear el run", result.error);
  await appendBrainRunEvent(input.tenant, result.data.id, "run.started", {
    channel: input.channel,
    conversationId: input.conversationId,
  });
  return result.data.id;
}

export async function updateBrainRun(input: {
  response?: unknown;
  runId: string;
  status: RunStatus;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const completed = ["cancelled", "completed", "denied", "failed"].includes(input.status);
  const result = await supabase
    .from("brain_runs")
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      response: asJson(input.response),
      status: input.status,
    })
    .eq("id", input.runId)
    .eq("empresa_id", input.tenant.empresaId);
  if (result.error) throw databaseError("No se pudo actualizar el run", result.error);
}

export async function appendBrainRunEvent(
  tenant: TenantContext,
  runId: string,
  eventType: string,
  payload: unknown = {},
) {
  const supabase = await createClient();
  const result = await supabase.from("brain_run_events").insert({
    empresa_id: tenant.empresaId,
    event_type: eventType,
    payload: asJson(payload),
    run_id: runId,
  });
  if (result.error) throw databaseError("No se pudo registrar el evento", result.error);
}

export async function recordBrainRunStep(input: {
  error?: unknown;
  output?: unknown;
  runId: string;
  status: "completed" | "failed" | "running" | "waiting_approval";
  stepId: string;
  tenant: TenantContext;
  toolName?: string | null;
}) {
  const now = new Date().toISOString();
  const supabase = await createClient();
  const result = await supabase.from("brain_run_steps").upsert(
    {
      completed_at: ["completed", "failed"].includes(input.status) ? now : null,
      empresa_id: input.tenant.empresaId,
      error: input.error ? asJson(input.error) : null,
      output: asJson(input.output),
      run_id: input.runId,
      started_at: now,
      status: input.status,
      step_id: input.stepId,
      tool_name: input.toolName ?? null,
    },
    { onConflict: "run_id,step_id" },
  );
  if (result.error) throw databaseError("No se pudo registrar el paso", result.error);
}

export async function recordBrainUsage(input: {
  completionTokens?: number;
  conversationId: string;
  durationMs?: number;
  metadata?: unknown;
  model: string;
  promptTokens?: number;
  provider: string;
  runId: string;
  tenant: TenantContext;
}) {
  const promptTokens = input.promptTokens ?? 0;
  const completionTokens = input.completionTokens ?? 0;
  const supabase = await createClient();
  const result = await supabase.from("brain_usage_events").insert({
    completion_tokens: completionTokens,
    conversation_id: input.conversationId,
    duration_ms: input.durationMs ?? null,
    empresa_id: input.tenant.empresaId,
    metadata: asJson(input.metadata),
    model: input.model,
    profile_id: input.tenant.profileId,
    prompt_tokens: promptTokens,
    provider: input.provider,
    run_id: input.runId,
    status: "completed",
    total_tokens: promptTokens + completionTokens,
  });
  if (result.error) throw databaseError("No se pudo registrar el uso", result.error);
}

export async function assertBrainDailyLimit(
  tenant: TenantContext,
  dailyLimit: number,
) {
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);
  const supabase = await createClient();
  const result = await supabase
    .from("brain_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", tenant.empresaId)
    .eq("profile_id", tenant.profileId)
    .gte("created_at", startOfUtcDay.toISOString());
  if (result.error) throw databaseError("No se pudo validar el límite diario", result.error);
  if ((result.count ?? 0) >= dailyLimit) {
    throw new Error(
      `Alcanzaste el límite diario de ${dailyLimit} llamadas de Brain. Un administrador puede ajustarlo en la configuración de IA.`,
    );
  }
}

export async function recordBrainFeedback(input: {
  comment?: string | null;
  conversationId: string;
  messageId: string;
  rating: -1 | 1;
  tenant: TenantContext;
}) {
  const supabase = await createClient();
  const message = await supabase
    .from("brain_messages")
    .select("message_id, role")
    .eq("empresa_id", input.tenant.empresaId)
    .eq("profile_id", input.tenant.profileId)
    .eq("conversation_id", input.conversationId)
    .eq("message_id", input.messageId)
    .eq("role", "assistant")
    .maybeSingle<{ message_id: string; role: string }>();
  if (message.error) throw databaseError("No se pudo validar la respuesta", message.error);
  if (!message.data) throw new Error("La respuesta de Brain no existe en esta conversación.");

  const result = await supabase.from("brain_feedback").upsert(
    {
      comment: input.comment?.trim() || null,
      conversation_id: input.conversationId,
      empresa_id: input.tenant.empresaId,
      message_id: input.messageId,
      profile_id: input.tenant.profileId,
      rating: input.rating,
    },
    { onConflict: "conversation_id,message_id,profile_id" },
  );
  if (result.error) throw databaseError("No se pudo guardar el feedback", result.error);
}

export async function syncBrainApprovals(input: {
  conversationId: string;
  messages: UIMessage[];
  riskByTool: Record<string, BusinessSkillRisk>;
  runId: string;
  tenant: TenantContext;
}) {
  const rows: JsonRecord[] = [];
  for (const message of input.messages) {
    for (const rawPart of message.parts) {
      const part = rawPart as unknown as {
        approval?: { approved?: boolean; id?: string };
        input?: unknown;
        state?: string;
        toolCallId?: string;
        type?: string;
      };
      if (!part.type?.startsWith("tool-") || !part.approval?.id) continue;
      const toolName = part.type.slice("tool-".length);
      const decided = typeof part.approval.approved === "boolean";
      if (decided) continue;
      const proposalHash = approvalProposalHash(part.input);
      rows.push({
        approval_id: part.approval.id,
        conversation_id: input.conversationId,
        decided_at: null,
        decided_by: null,
        empresa_id: input.tenant.empresaId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: part.approval.id,
        proposal_hash: proposalHash,
        proposal_version: "brain-central-v1",
        request: asJson(part.input),
        requested_by: input.tenant.profileId,
        risk: input.riskByTool[toolName] ?? "high",
        run_id: input.runId,
        status: "pending",
        tool_call_id: part.toolCallId ?? null,
        tool_name: toolName,
      });
    }
  }
  if (rows.length === 0) return;
  const supabase = await createClient();
  const result = await supabase
    .from("brain_approvals")
    .upsert(rows, { onConflict: "empresa_id,approval_id" });
  if (result.error) throw databaseError("No se pudo registrar la aprobación", result.error);
}

export async function validateIncomingBrainApprovals(input: {
  conversationId: string;
  message: UIMessage;
  tenant: TenantContext;
}) {
  const decisions = input.message.parts
    .map((rawPart) => rawPart as unknown as {
      approval?: { approved?: boolean; id?: string };
      input?: unknown;
      toolCallId?: string;
      type?: string;
    })
    .filter(
      (part) =>
        part.type?.startsWith("tool-") &&
        part.approval?.id &&
        typeof part.approval.approved === "boolean",
    );
  if (decisions.length === 0) return;

  const supabase = await createClient();
  for (const part of decisions) {
    const approvalId = part.approval?.id as string;
    const toolName = (part.type as string).slice("tool-".length);
    const pending = await supabase
      .from("brain_approvals")
      .select("id, proposal_hash, request, status, tool_call_id, tool_name")
      .eq("empresa_id", input.tenant.empresaId)
      .eq("conversation_id", input.conversationId)
      .eq("requested_by", input.tenant.profileId)
      .eq("approval_id", approvalId)
      .eq("status", "pending")
      .maybeSingle<{
        id: string;
        proposal_hash: string | null;
        request: unknown;
        status: string;
        tool_call_id: string | null;
        tool_name: string;
      }>();
    if (pending.error) throw databaseError("No se pudo validar la aprobación", pending.error);
    if (!pending.data) {
      throw new Error("La aprobación no existe, ya fue resuelta o no pertenece a esta conversación.");
    }
    if (
      pending.data.tool_name !== toolName ||
      pending.data.tool_call_id !== (part.toolCallId ?? null) ||
      !sameJson(pending.data.request, part.input)
    ) {
      throw new Error("La aprobación fue alterada y Brain bloqueó su ejecución.");
    }
    const proposalHash = approvalProposalHash(part.input);
    if (!pending.data.proposal_hash || pending.data.proposal_hash !== proposalHash) {
      throw new Error("La propuesta cambió desde que se solicitó la aprobación.");
    }
    const decision = await supabase.rpc("decide_brain_proposal", {
      p_approval_id: approvalId,
      p_approved: part.approval?.approved === true,
      p_proposal_hash: proposalHash,
    });
    if (decision.error) throw databaseError("No se pudo guardar la decisión", decision.error);
    if (decision.data !== true) throw new Error("La aprobación expiró o ya fue utilizada.");
  }
}
