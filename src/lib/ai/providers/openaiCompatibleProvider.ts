import type {
  AiProviderAdapter,
  AiProviderGenerateInput,
  AiProviderGenerateResult,
} from "@/lib/ai/providers/types";
import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";

function getDefaultBaseUrl(provider: ConversationLayerSettingsForProvider["provider"]) {
  if (provider === "groq-compatible") return "https://api.groq.com/openai/v1";
  if (provider === "openrouter-compatible") return "https://openrouter.ai/api/v1";
  if (provider === "ollama-compatible") return "http://localhost:11434/v1";

  return DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
}

function getChatCompletionsUrl(settings: ConversationLayerSettingsForProvider) {
  const baseUrl = (settings.baseUrl ?? getDefaultBaseUrl(settings.provider)).replace(/\/+$/, "");

  return `${baseUrl}/chat/completions`;
}

async function generateJson(
  input: AiProviderGenerateInput,
): Promise<AiProviderGenerateResult> {
  if (!input.settings.apiKey && input.settings.provider !== "ollama-compatible") {
    throw new Error("API_KEY_MISSING");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (input.settings.apiKey) {
    headers.Authorization = `Bearer ${input.settings.apiKey}`;
  }

  const response = await fetch(getChatCompletionsUrl(input.settings), {
    body: JSON.stringify({
      max_tokens: input.settings.maxTokens,
      messages: input.messages,
      model: input.settings.model,
      response_format:
        input.settings.outputMode === "strict_json"
          ? { type: "json_object" }
          : undefined,
      temperature: input.settings.temperature,
    }),
    headers,
    method: "POST",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `PROVIDER_CONNECTION_FAILED:${response.status}:${details.slice(0, 240)}`,
    );
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("INVALID_AI_RESPONSE");
  }

  return { content };
}

async function test(settings: ConversationLayerSettingsForProvider) {
  return generateJson({
    messages: [
      {
        content: "Responde solo este JSON: {\"ok\":true}",
        role: "user",
      },
    ],
    settings,
  });
}

export const openaiCompatibleProvider: AiProviderAdapter = {
  generateJson,
  test,
};
