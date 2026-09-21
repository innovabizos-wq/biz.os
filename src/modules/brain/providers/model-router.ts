import "server-only";

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { getBrainAiProviderSettings } from "@/modules/ai/conversation-layer-service";
import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";

function openAiCompatibleBaseUrl(settings: ConversationLayerSettingsForProvider) {
  if (settings.baseUrl) return settings.baseUrl.replace(/\/+$/, "");
  if (settings.provider === "groq-compatible") return "https://api.groq.com/openai/v1";
  if (settings.provider === "openrouter-compatible") return "https://openrouter.ai/api/v1";
  if (settings.provider === "ollama-compatible") return "http://localhost:11434/v1";
  return "https://api.openai.com/v1";
}

export type BrainModelTier = "fast" | "strong";

export function classifyBrainModelTier(input?: {
  currentModule?: string | null;
  message?: string | null;
  requestedTeam?: boolean;
  risk?: "critical" | "high" | "low" | "medium";
  selectedSkillCount?: number;
}) {
  const message = input?.message?.trim() ?? "";
  const transversal = new Set(
    [
      "crm", "cliente", "venta", "cotizacion", "inventario", "compra",
      "pago", "cobro", "factura", "despacho", "rrhh", "inbox", "whatsapp",
      "marketing", "contenido", "reporte",
    ].filter((term) => message.toLowerCase().includes(term)),
  ).size;
  const reasons = [
    input?.requestedTeam ? "equipo" : null,
    input?.risk === "high" || input?.risk === "critical" ? "riesgo" : null,
    transversal >= 2 ? "varios-modulos" : null,
    (input?.selectedSkillCount ?? 0) >= 5 ? "varias-tools" : null,
    message.length >= 500 ? "contexto-extenso" : null,
    /planifica|estrategia|analiza|investiga|compara|coordina|equipo/i.test(message)
      ? "planificacion"
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    reason: reasons.length > 0 ? reasons.join(",") : "ruta-simple",
    tier: reasons.length > 0 ? "strong" as const : "fast" as const,
  };
}

function routedModelId(
  settings: ConversationLayerSettingsForProvider,
  tier: BrainModelTier,
) {
  const providerKey = settings.provider === "gemini" ? "GEMINI" : "COMPATIBLE";
  const configured = process.env[`BRAIN_${providerKey}_${tier.toUpperCase()}_MODEL`]?.trim();
  return configured || settings.model;
}

export async function resolveBrainLanguageModel(input?: Parameters<typeof classifyBrainModelTier>[0]): Promise<{
  model: LanguageModel;
  modelId: string;
  routing: ReturnType<typeof classifyBrainModelTier>;
  settings: ConversationLayerSettingsForProvider;
}> {
  const result = await getBrainAiProviderSettings();
  if (!result.ok) throw new Error(result.error.message);
  const settings = result.data;
  if (!settings.enabled) throw new Error("La configuración central de Brain está desactivada.");
  if (!settings.apiKey && settings.provider !== "ollama-compatible") {
    throw new Error("Brain no tiene una API Key configurada para el proveedor activo.");
  }
  const routing = classifyBrainModelTier(input);
  const modelId = routedModelId(settings, routing.tier);

  if (settings.provider === "gemini") {
    const provider = createGoogleGenerativeAI({
      apiKey: settings.apiKey ?? undefined,
      baseURL: settings.baseUrl ?? undefined,
      name: "biz-brain-google",
    });
    return { model: provider(modelId), modelId, routing, settings };
  }

  const provider = createOpenAICompatible({
    apiKey: settings.apiKey ?? undefined,
    baseURL: openAiCompatibleBaseUrl(settings),
    includeUsage: true,
    name: `biz-brain-${settings.provider}`,
    supportsStructuredOutputs: true,
  });
  return { model: provider.chatModel(modelId), modelId, routing, settings };
}
