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
};

export type AiProviderAdapter = {
  generateJson(input: AiProviderGenerateInput): Promise<AiProviderGenerateResult>;
  test(settings: ConversationLayerSettingsForProvider): Promise<AiProviderGenerateResult>;
};
