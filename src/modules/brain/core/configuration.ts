import "server-only";

import { getBrainAiSettings } from "@/modules/brain/ai-service";
import type {
  BrainConfiguration,
  BrainConfigurationService,
  BrainProviderCode,
} from "@/modules/brain/core/contracts";
import type { CoreResult, TenantContext } from "@/types/core";
import { ok } from "@/types/core";

const DEFAULT_TIMEOUT_MS = 30_000;

function mapProvider(provider: string): BrainProviderCode {
  if (provider === "gemini") return "gemini";
  if (provider === "ollama-compatible") return "ollama";
  if (provider === "openai-compatible") return "openai-compatible";
  if (provider === "groq-compatible" || provider === "openrouter-compatible") {
    return "openai-compatible";
  }

  return "other";
}

export async function getBrainCoreConfiguration(
  tenant: TenantContext,
): Promise<CoreResult<BrainConfiguration>> {
  const settings = await getBrainAiSettings(tenant);
  if (!settings.ok) return settings;

  return ok({
    activeProvider: mapProvider(settings.data.provider),
    apiKeyLast4: settings.data.apiKeyLast4,
    hasApiKey: settings.data.hasApiKey,
    maxTokens: settings.data.maxTokens,
    model: settings.data.model,
    streaming: false,
    temperature: settings.data.temperature,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
}

export const brainCoreConfigurationService: BrainConfigurationService = {
  getConfiguration: getBrainCoreConfiguration,
};
