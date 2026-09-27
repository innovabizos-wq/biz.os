import {
  createAgentUIStreamResponse,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentTenantContext } from "@/lib/auth/session";
import { createCentralBrainAgent } from "@/modules/brain/runtime/brain-agent";
import {
  appendBrainRunEvent,
  assertBrainDailyLimit,
  createBrainConversationRun,
  getOrCreateBrainConversation,
  loadBrainMessages,
  recordBrainUsage,
  saveBrainMessages,
  syncBrainApprovals,
  updateBrainRun,
  validateIncomingBrainApprovals,
} from "@/modules/brain/runtime/conversation-repository";
import { resolveBrainLanguageModel } from "@/modules/brain/providers/model-router";
import { brainChatFailure } from "@/modules/brain/runtime/chat-errors";
import { hasBrainMessageContent, prepareIncomingBrainMessage } from "@/modules/brain/runtime/conversation-messages";

export const maxDuration = 60;

const requestSchema = z.object({
  channel: z.enum(["bar", "brain", "internal", "customer", "api", "automation"]).default("bar"),
  currentModule: z.string().trim().max(80).nullish(),
  currentPath: z.string().trim().max(500).nullish(),
  entity: z.object({
    id: z.string().max(200).optional(),
    label: z.string().max(300).optional(),
    type: z.string().trim().min(1).max(100),
  }).nullish(),
  id: z.string().uuid(),
  message: z.object({
    id: z.string().min(1).max(200),
    parts: z.array(z.unknown()),
    role: z.enum(["user", "assistant"]),
  }).passthrough(),
  selection: z.string().max(2_000).nullish(),
  timezone: z.string().trim().max(100).nullish(),
});

function textFromMessage(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
}

function latestUserText(messages: UIMessage[]) {
  return [...messages]
    .reverse()
    .filter((message) => message.role === "user")
    .map(textFromMessage)
    .find(Boolean) ?? "Continúa la ejecución aprobada y explica el resultado.";
}

function historicalToolNames(messages: UIMessage[]) {
  const names = new Set<string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type.startsWith("tool-")) names.add(part.type.slice("tool-".length));
    }
  }
  return [...names];
}

function hasPendingApproval(messages: UIMessage[]) {
  return messages.some((message) =>
    message.parts.some((rawPart) => {
      const part = rawPart as unknown as { approval?: { approved?: boolean }; state?: string };
      return part.state === "approval-requested" && typeof part.approval?.approved !== "boolean";
    }),
  );
}

function hasDeniedApproval(messages: UIMessage[]) {
  return messages.some((message) =>
    message.parts.some((rawPart) => {
      const part = rawPart as unknown as { approval?: { approved?: boolean } };
      return part.approval?.approved === false;
    }),
  );
}

function mergeIncomingMessage(messages: UIMessage[], incoming: UIMessage) {
  const existing = messages.findIndex((message) => message.id === incoming.id);
  if (existing < 0) return [...messages, incoming];
  return messages.map((message, index) => (index === existing ? incoming : message));
}

export async function POST(request: Request) {
  const tenantResult = await getCurrentTenantContext();
  if (!tenantResult.ok || !tenantResult.data) {
    return NextResponse.json(
      { error: tenantResult.ok ? "No hay una empresa activa." : tenantResult.error.message },
      { status: 401 },
    );
  }

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { details: body.error.flatten(), error: "La solicitud de Brain no es válida." },
      { status: 400 },
    );
  }
  if (body.data.channel === "customer") {
    return NextResponse.json(
      { error: "Las conversaciones de clientes deben usar el adaptador verificado de Brain." },
      { status: 400 },
    );
  }

  const tenant = tenantResult.data;
  let incoming = body.data.message as UIMessage;
  let runId: string | null = null;

  try {
    const conversationId = await getOrCreateBrainConversation({
      channel: body.data.channel,
      conversationId: body.data.id,
      currentPath: body.data.currentPath,
      tenant,
    });
    const previous = await loadBrainMessages(tenant, conversationId);
    const prepared = prepareIncomingBrainMessage(previous, incoming);
    incoming = prepared.message;
    await validateIncomingBrainApprovals({ conversationId, message: { ...incoming, parts: prepared.decisions }, tenant });
    const messages = mergeIncomingMessage(previous, incoming);
    await saveBrainMessages({ conversationId, messages: [incoming], tenant });
    runId = await createBrainConversationRun({
      channel: body.data.channel,
      conversationId,
      message: incoming,
      tenant,
    });

    const userText = latestUserText(messages);
    const { model, modelId, routing, settings } = await resolveBrainLanguageModel({
      currentModule: body.data.currentModule,
      message: userText,
    });
    await assertBrainDailyLimit(tenant, settings.dailyLimit);
    const { agent, riskByTool, selectedSkillIds } = await createCentralBrainAgent({
      conversationId,
      currentModule: body.data.currentModule,
      currentPath: body.data.currentPath,
      entity: body.data.entity ?? undefined,
      historicalToolNames: historicalToolNames(messages),
      message: userText,
      model,
      runId,
      selection: body.data.selection ?? undefined,
      settings,
      tenant,
      timezone: body.data.timezone ?? undefined,
    });
    await appendBrainRunEvent(tenant, runId, "agent.tools.selected", {
      modelId,
      routing,
      selectedSkillIds,
    });

    let modelStep = 0;
    let streamFailure: ReturnType<typeof brainChatFailure> | null = null;
    const startedAt = performance.now();
    return await createAgentUIStreamResponse({
      agent,
      onError: (error) => {
        streamFailure = brainChatFailure(error);
        console.error("[brain.chat.stream]", { runId, code: streamFailure.code });
        return streamFailure.message;
      },
      headers: {
        "x-brain-conversation-id": conversationId,
        "x-brain-run-id": runId,
      },
      onFinish: async ({ finishReason, isAborted, messages: completedMessages, responseMessage }) => {
        try {
          if (!isAborted && !hasBrainMessageContent(responseMessage) && !streamFailure) {
            streamFailure = { code: "EMPTY_RESPONSE", message: "Brain terminó sin una respuesta. Puedes reintentar tu mensaje." };
          }
          await saveBrainMessages({
            conversationId,
            messages: completedMessages,
            tenant,
          });
          await syncBrainApprovals({
            conversationId,
            messages: completedMessages,
            riskByTool,
            runId: runId as string,
            tenant,
          });
          const status = streamFailure || finishReason === "error"
            ? "failed"
            : isAborted
              ? "cancelled"
              : hasPendingApproval([responseMessage])
                ? "waiting_approval"
                : hasDeniedApproval([responseMessage])
                  ? "denied"
                  : "completed";
          await updateBrainRun({
            response: { messageCount: completedMessages.length, ...(streamFailure ? { error: streamFailure } : {}) },
            runId: runId as string,
            status,
            tenant,
          });
          await appendBrainRunEvent(tenant, runId as string, `run.${status}`, streamFailure ?? {});
        } catch (error) {
          console.error("[brain.chat.persistence]", { runId, code: "PERSISTENCE_FAILED" });
          await updateBrainRun({ tenant, runId: runId as string, status: "failed", response: { error: { code: "PERSISTENCE_FAILED", message: "No se pudo guardar la conversación." } } }).catch(() => undefined);
          throw error;
        }
      },
      onStepEnd: async ({ finishReason, toolCalls, usage }) => {
        modelStep += 1;
        try {
          await recordBrainUsage({
            completionTokens: usage.outputTokens,
            conversationId,
            durationMs: Math.round(performance.now() - startedAt),
            metadata: { finishReason, modelStep, toolCalls: toolCalls.length },
            model: modelId,
            promptTokens: usage.inputTokens,
            provider: settings.provider,
            runId: runId as string,
            tenant,
          });
          await appendBrainRunEvent(tenant, runId as string, "model.step.completed", {
            finishReason,
            modelStep,
            toolCalls: toolCalls.map((call) => call.toolName),
          });
        } catch (error) {
          console.error("[brain.chat.telemetry]", error);
        }
      },
      timeout: { totalMs: 55_000 },
      uiMessages: messages,
    });
  } catch (error) {
    if (runId) {
      await updateBrainRun({
        response: { error: error instanceof Error ? error.message : "Error desconocido" },
        runId,
        status: "failed",
        tenant,
      }).catch(() => undefined);
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Brain no pudo iniciar esta conversación.",
      },
      { status: 500 },
    );
  }
}
