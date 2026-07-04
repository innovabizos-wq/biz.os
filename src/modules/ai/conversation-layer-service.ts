import "server-only";

import { getConversationProviderAdapter } from "@/lib/ai/providers";
import { createClient } from "@/lib/supabase/server";
import {
  conversationLayerIntentSchema,
  conversationLayerNaturalizedResponseSchema,
  conversationLayerSettingsSchema,
} from "@/modules/ai/schemas";
import {
  BRAIN_CONVERSATION_NATURALIZE_PROMPT,
  BRAIN_CONVERSATION_ROUTER_PROMPT,
} from "@/modules/brain/brain-prompts";
import { decryptAiSecret, encryptAiSecret } from "@/modules/ai/crypto";
import type {
  ConversationLayerErrorCode,
  ConversationLayerInterpretInput,
  ConversationLayerIntent,
  ConversationLayerNaturalizeInput,
  ConversationLayerNaturalizedResponse,
  ConversationLayerSettings,
  ConversationLayerSettingsForProvider,
} from "@/modules/ai/types";
import type { CoreResult, JsonRecord, TenantContext } from "@/types/core";
import { createCoreError, fail, ok } from "@/types/core";

const AI_SETTINGS_KEY = "ai_provider";
const LEGACY_AI_SETTINGS_KEY = "ai_conversation_layer";

type StoredConversationLayerSettings = Partial<ConversationLayerSettings> & {
  apiKeyEncrypted?: string | null;
};

type UpdateConversationLayerSettingsInput = {
  apiKey?: string;
  baseUrl?: string | null;
  dailyLimit: number;
  enabled: boolean;
  maxTokens: number;
  model: string;
  outputMode: ConversationLayerSettings["outputMode"];
  provider: ConversationLayerSettings["provider"];
  temperature: number;
};

type ConversationLayerResult<T> =
  | CoreResult<T>
  | {
      data: null;
      error: {
        code: ConversationLayerErrorCode;
        message: string;
      };
      ok: false;
    };

export const DEFAULT_CONVERSATION_LAYER_SETTINGS: ConversationLayerSettings = {
  apiKeyLast4: null,
  baseUrl: null,
  dailyLimit: 100,
  enabled: false,
  hasApiKey: false,
  lastTestAt: null,
  lastTestMessage: null,
  lastTestStatus: null,
  maxTokens: 1200,
  model: "gemini-2.5-flash-lite",
  outputMode: "strict_json",
  provider: "gemini",
  temperature: 0.2,
};

function conversationLayerFail<T>(
  code: ConversationLayerErrorCode,
  message: string,
): ConversationLayerResult<T> {
  return {
    data: null,
    error: { code, message },
    ok: false,
  };
}

function asStoredSettings(value: unknown): StoredConversationLayerSettings {
  return value && typeof value === "object"
    ? value as StoredConversationLayerSettings
    : {};
}

function normalizeSettings(value: unknown): ConversationLayerSettings {
  const stored = asStoredSettings(value);
  const parsed = conversationLayerSettingsSchema.safeParse({
    baseUrl: stored.baseUrl,
    dailyLimit: stored.dailyLimit,
    enabled: stored.enabled,
    maxTokens: stored.maxTokens,
    model: stored.model,
    outputMode: stored.outputMode,
    provider: stored.provider,
    temperature: stored.temperature,
  });
  const base = parsed.success
    ? parsed.data
    : {
        baseUrl: DEFAULT_CONVERSATION_LAYER_SETTINGS.baseUrl ?? undefined,
        dailyLimit: DEFAULT_CONVERSATION_LAYER_SETTINGS.dailyLimit,
        enabled: DEFAULT_CONVERSATION_LAYER_SETTINGS.enabled,
        maxTokens: DEFAULT_CONVERSATION_LAYER_SETTINGS.maxTokens,
        model: DEFAULT_CONVERSATION_LAYER_SETTINGS.model,
        outputMode: DEFAULT_CONVERSATION_LAYER_SETTINGS.outputMode,
        provider: DEFAULT_CONVERSATION_LAYER_SETTINGS.provider,
        temperature: DEFAULT_CONVERSATION_LAYER_SETTINGS.temperature,
      };

  return {
    apiKeyLast4:
      typeof stored.apiKeyLast4 === "string" && stored.apiKeyLast4.length > 0
        ? stored.apiKeyLast4
        : null,
    baseUrl: base.baseUrl ?? null,
    dailyLimit: base.dailyLimit,
    enabled: base.enabled || Boolean(stored.apiKeyEncrypted),
    hasApiKey: Boolean(stored.apiKeyEncrypted),
    lastTestAt:
      typeof stored.lastTestAt === "string" && stored.lastTestAt.length > 0
        ? stored.lastTestAt
        : null,
    lastTestMessage:
      typeof stored.lastTestMessage === "string" && stored.lastTestMessage.length > 0
        ? stored.lastTestMessage
        : null,
    lastTestStatus:
      stored.lastTestStatus === "success" || stored.lastTestStatus === "error"
        ? stored.lastTestStatus
        : null,
    maxTokens: base.maxTokens,
    model: base.model,
    outputMode: base.outputMode,
    provider: base.provider,
    temperature: base.temperature,
  };
}

function redactSettings(value: unknown): ConversationLayerSettings {
  return normalizeSettings(value);
}

function parseJsonObject(content: string) {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON_PARSE_FAILED");

    return JSON.parse(match[0]) as unknown;
  }
}

async function getStoredConversationLayerSettings() {
  const supabase = await createClient();
  const [current, legacy] = await Promise.all([
    supabase.rpc("obtener_configuracion_empresa", {
      p_clave: AI_SETTINGS_KEY,
    }),
    supabase.rpc("obtener_configuracion_empresa", {
      p_clave: LEGACY_AI_SETTINGS_KEY,
    }),
  ]);

  if (current.error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudo leer la configuracion de IA.",
      current.error,
    );
  }

  const currentSettings = asStoredSettings(current.data);
  const legacySettings = legacy.error ? {} : asStoredSettings(legacy.data);

  return ok({
    ...legacySettings,
    ...currentSettings,
  });
}

async function saveStoredConversationLayerSettings(
  value: StoredConversationLayerSettings,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_configuracion_empresa", {
    p_clave: AI_SETTINGS_KEY,
    p_valor: value as JsonRecord,
  });

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudo guardar la configuracion de IA.",
      error,
    );
  }

  return ok(redactSettings(value));
}

export async function getConversationLayerSettings(
  tenant: TenantContext,
): Promise<CoreResult<ConversationLayerSettings>> {
  void tenant;

  const stored = await getStoredConversationLayerSettings();
  if (!stored.ok) return stored;

  return ok(redactSettings(stored.data));
}

export async function getConversationLayerProviderSettings(): Promise<
  ConversationLayerResult<ConversationLayerSettingsForProvider>
> {
  const stored = await getStoredConversationLayerSettings();
  if (!stored.ok) return stored;

  const settings = normalizeSettings(stored.data);
  const encrypted = stored.data.apiKeyEncrypted;
  let apiKey: string | null = null;

  if (encrypted) {
    try {
      apiKey = decryptAiSecret(encrypted);
    } catch {
      return conversationLayerFail(
        "API_KEY_MISSING",
        "No se pudo descifrar la API Key. Verifica los secretos de cifrado del servidor.",
      );
    }
  }

  return ok({ ...settings, apiKey });
}

export async function updateConversationLayerSettings(
  tenant: TenantContext,
  payload: UpdateConversationLayerSettingsInput,
): Promise<ConversationLayerResult<ConversationLayerSettings>> {
  void tenant;

  const current = await getStoredConversationLayerSettings();
  if (!current.ok) return current;

  const currentStored = current.data;
  let apiKeyEncrypted = currentStored.apiKeyEncrypted ?? null;
  let apiKeyLast4 = currentStored.apiKeyLast4 ?? null;

  if (payload.apiKey) {
    try {
      apiKeyEncrypted = encryptAiSecret(payload.apiKey);
      apiKeyLast4 = payload.apiKey.slice(-4);
    } catch {
      return conversationLayerFail(
        "API_KEY_MISSING",
        "Falta un secreto de cifrado del servidor para guardar la API Key de IA.",
      );
    }
  }

  const next: StoredConversationLayerSettings = {
    ...currentStored,
    apiKeyEncrypted,
    apiKeyLast4,
    baseUrl: payload.baseUrl ?? null,
    dailyLimit: payload.dailyLimit,
    enabled: payload.enabled || Boolean(payload.apiKey) || Boolean(apiKeyEncrypted),
    hasApiKey: Boolean(apiKeyEncrypted),
    maxTokens: payload.maxTokens,
    model: payload.model,
    outputMode: payload.outputMode,
    provider: payload.provider,
    temperature: payload.temperature,
  };

  return saveStoredConversationLayerSettings(next);
}

async function updateTestStatus(
  status: "error" | "success",
  message: string,
): Promise<CoreResult<ConversationLayerSettings>> {
  const stored = await getStoredConversationLayerSettings();
  if (!stored.ok) return stored;

  return saveStoredConversationLayerSettings({
    ...stored.data,
    lastTestAt: new Date().toISOString(),
    lastTestMessage: message,
    lastTestStatus: status,
  });
}

export async function testConversationProvider(
  tenant: TenantContext,
): Promise<ConversationLayerResult<ConversationLayerSettings>> {
  void tenant;

  const settings = await getConversationLayerProviderSettings();
  if (!settings.ok) {
    await updateTestStatus("error", settings.error.message);
    return settings;
  }

  if (!settings.data.apiKey && settings.data.provider !== "ollama-compatible") {
    const message = "Configura una API Key antes de probar la conexion.";
    await updateTestStatus("error", message);
    return conversationLayerFail("API_KEY_MISSING", message);
  }

  try {
    const adapter = getConversationProviderAdapter(settings.data.provider);
    await adapter.test(settings.data);
    return updateTestStatus("success", "Conexion correcta con el proveedor.");
  } catch {
    const message =
      "No se pudo conectar con el proveedor de IA. Revise la API Key, el modelo seleccionado o la URL base.";
    await updateTestStatus("error", message);
    return conversationLayerFail("PROVIDER_CONNECTION_FAILED", message);
  }
}

export async function interpretUserMessage(
  input: ConversationLayerInterpretInput,
): Promise<ConversationLayerResult<ConversationLayerIntent>> {
  const settings = await getConversationLayerProviderSettings();
  if (!settings.ok) return settings;

  if (!settings.data.enabled) {
    return conversationLayerFail(
      "CONVERSATION_LAYER_DISABLED",
      "La configuracion de IA esta desactivada.",
    );
  }

  if (!settings.data.apiKey && settings.data.provider !== "ollama-compatible") {
    return conversationLayerFail(
      "API_KEY_MISSING",
      "Configura una API Key antes de interpretar mensajes.",
    );
  }

  try {
    const adapter = getConversationProviderAdapter(settings.data.provider);
    const result = await adapter.generateJson({
      messages: [
        { content: BRAIN_CONVERSATION_ROUTER_PROMPT, role: "system" },
        { content: JSON.stringify(input), role: "user" },
      ],
      settings: settings.data,
    });
    const parsed = conversationLayerIntentSchema.safeParse(
      parseJsonObject(result.content),
    );

    if (!parsed.success) {
      return conversationLayerFail(
        "INVALID_AI_RESPONSE",
        "El proveedor no devolvio una intencion valida.",
      );
    }

    return ok(parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "JSON_PARSE_FAILED") {
      return conversationLayerFail(
        "JSON_PARSE_FAILED",
        "El proveedor no devolvio JSON valido.",
      );
    }

    return conversationLayerFail(
      "PROVIDER_CONNECTION_FAILED",
      "No se pudo obtener respuesta del proveedor de IA.",
    );
  }
}

export async function naturalizeSystemResponse(
  input: ConversationLayerNaturalizeInput,
): Promise<ConversationLayerResult<ConversationLayerNaturalizedResponse>> {
  const settings = await getConversationLayerProviderSettings();
  if (!settings.ok) return settings;

  if (!settings.data.enabled) {
    return conversationLayerFail(
      "CONVERSATION_LAYER_DISABLED",
      "La configuracion de IA esta desactivada.",
    );
  }

  if (!settings.data.apiKey && settings.data.provider !== "ollama-compatible") {
    return conversationLayerFail(
      "API_KEY_MISSING",
      "Configura una API Key antes de naturalizar respuestas.",
    );
  }

  try {
    const adapter = getConversationProviderAdapter(settings.data.provider);
    const result = await adapter.generateJson({
      messages: [
        { content: BRAIN_CONVERSATION_NATURALIZE_PROMPT, role: "system" },
        { content: JSON.stringify(input), role: "user" },
      ],
      settings: settings.data,
    });
    const parsed = conversationLayerNaturalizedResponseSchema.safeParse(
      parseJsonObject(result.content),
    );

    if (!parsed.success) {
      return conversationLayerFail(
        "INVALID_AI_RESPONSE",
        "El proveedor no devolvio un mensaje valido.",
      );
    }

    return ok(parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "JSON_PARSE_FAILED") {
      return conversationLayerFail(
        "JSON_PARSE_FAILED",
        "El proveedor no devolvio JSON valido.",
      );
    }

    return conversationLayerFail(
      "PROVIDER_CONNECTION_FAILED",
      "No se pudo obtener respuesta del proveedor de IA.",
    );
  }
}

export async function runConversationLayer(input: ConversationLayerInterpretInput) {
  return interpretUserMessage(input);
}

export async function naturalizeResponse(input: ConversationLayerNaturalizeInput) {
  return naturalizeSystemResponse(input);
}

export async function getBrainAiSettings(tenant: TenantContext) {
  return getConversationLayerSettings(tenant);
}

export async function getBrainAiProviderSettings() {
  return getConversationLayerProviderSettings();
}

export async function updateBrainAiSettings(
  tenant: TenantContext,
  payload: UpdateConversationLayerSettingsInput,
) {
  return updateConversationLayerSettings(tenant, payload);
}

export async function testBrainAiConnection(tenant: TenantContext) {
  return testConversationProvider(tenant);
}

export async function interpretBrainMessage(input: ConversationLayerInterpretInput) {
  return interpretUserMessage(input);
}

export async function naturalizeBrainResponse(input: ConversationLayerNaturalizeInput) {
  return naturalizeSystemResponse(input);
}

export async function runBrainConversation(input: ConversationLayerInterpretInput) {
  return interpretUserMessage(input);
}

export function toConversationLayerCoreError(
  code: ConversationLayerErrorCode,
  message: string,
) {
  return createCoreError("MODULE_MISCONFIGURED", message, { code });
}

export function toBrainCoreError(code: ConversationLayerErrorCode, message: string) {
  return toConversationLayerCoreError(code, message);
}
