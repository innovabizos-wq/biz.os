import { geminiProvider } from "@/lib/ai/providers/geminiProvider";
import { openaiCompatibleProvider } from "@/lib/ai/providers/openaiCompatibleProvider";
import type { AiProviderAdapter } from "@/lib/ai/providers/types";
import type { ConversationLayerProvider } from "@/modules/ai/types";

export function getConversationProviderAdapter(
  provider: ConversationLayerProvider,
): AiProviderAdapter {
  if (provider === "gemini") return geminiProvider;

  return openaiCompatibleProvider;
}
