import "server-only";

import { getConversationProviderAdapter } from "@/lib/ai/providers";
import { getBrainAiProviderSettings } from "@/modules/brain/ai-service";
import type { BrainProviderHealth, BrainProviderStatus } from "@/modules/brain/core/contracts";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

function toStatus(errorMessage: string | null): BrainProviderStatus {
  if (!errorMessage) return "healthy";
  if (errorMessage.includes("API Key") || errorMessage.includes("API_KEY")) {
    return "missing_credentials";
  }

  return "error";
}

export async function checkBrainProviderHealth(
  tenant: TenantContext,
): Promise<CoreResult<BrainProviderHealth>> {
  void tenant;

  const startedAt = performance.now();
  const settings = await getBrainAiProviderSettings();

  if (!settings.ok) {
    return fail("MODULE_MISCONFIGURED", settings.error.message, settings.error);
  }

  if (!settings.data.enabled) {
    return ok({
      error: "La configuracion de IA esta desactivada.",
      model: settings.data.model,
      provider: settings.data.provider === "gemini" ? "gemini" : "openai-compatible",
      responseTimeMs: Math.round(performance.now() - startedAt),
      status: "disabled",
    });
  }

  try {
    const adapter = getConversationProviderAdapter(settings.data.provider);
    await adapter.test(settings.data);

    return ok({
      model: settings.data.model,
      provider: settings.data.provider === "gemini" ? "gemini" : "openai-compatible",
      responseTimeMs: Math.round(performance.now() - startedAt),
      status: "healthy",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido.";

    return ok({
      error: message,
      model: settings.data.model,
      provider: settings.data.provider === "gemini" ? "gemini" : "openai-compatible",
      responseTimeMs: Math.round(performance.now() - startedAt),
      status: toStatus(message),
    });
  }
}
