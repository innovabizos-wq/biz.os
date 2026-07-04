import type {
  AiProviderAdapter,
  AiProviderGenerateInput,
  AiProviderGenerateResult,
} from "@/lib/ai/providers/types";
import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";

const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function getGeminiUrl(settings: ConversationLayerSettingsForProvider) {
  const baseUrl = (settings.baseUrl ?? DEFAULT_GEMINI_BASE_URL).replace(/\/+$/, "");
  const model = encodeURIComponent(settings.model);

  return `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(settings.apiKey ?? "")}`;
}

function buildGeminiPrompt(input: AiProviderGenerateInput) {
  return input.messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

async function generateJson(
  input: AiProviderGenerateInput,
): Promise<AiProviderGenerateResult> {
  if (!input.settings.apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const response = await fetch(getGeminiUrl(input.settings), {
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildGeminiPrompt(input) }],
          role: "user",
        },
      ],
      generationConfig: {
        maxOutputTokens: input.settings.maxTokens,
        responseMimeType:
          input.settings.outputMode === "strict_json" ? "application/json" : undefined,
        temperature: input.settings.temperature,
      },
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `PROVIDER_CONNECTION_FAILED:${response.status}:${details.slice(0, 240)}`,
    );
  }

  const payload = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;

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

export const geminiProvider: AiProviderAdapter = {
  generateJson,
  test,
};
