import type { ConversationLayerSettingsForProvider } from "@/modules/ai/types";

export type AiProviderMessage = {
  content: string;
  role: "system" | "user";
};

export type AiProviderGenerateInput = {
  messages: AiProviderMessage[];
  settings: ConversationLayerSettingsForProvider;
};

export type AiProviderGenerateResult = {
  content: string;
  durationMs: number;
  responseId?: string;
  usage?: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
  };
};

export type AiProviderAdapter = {
  generateJson(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult>;
  test(settings: ConversationLayerSettingsForProvider): Promise<AiProviderGenerateResult>;
};
