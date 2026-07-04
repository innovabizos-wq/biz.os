import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import { getBrainAiSettings } from "@/modules/ai/conversation-layer-service";
import type {
  AiProviderSettings,
  AiUsageEvent,
} from "@/modules/ai/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type NameRelation = {
  nombre: string | null;
};

type AiUsageRow = {
  completion_tokens: number;
  created_at: string;
  feature: string;
  id: string;
  profile_id: string | null;
  profiles: NameRelation | NameRelation[] | null;
  prompt_tokens: number;
  provider: string | null;
  status: AiUsageEvent["status"];
};

function firstRelation<TRelation>(
  value: TRelation | TRelation[] | null,
): TRelation | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeSettings(value: unknown): AiProviderSettings {
  const settings = value && typeof value === "object" ? value as Record<string, unknown> : {};

  return {
    apiKeyLast4: typeof settings.apiKeyLast4 === "string" ? settings.apiKeyLast4 : null,
    baseUrl: typeof settings.baseUrl === "string" ? settings.baseUrl : null,
    dailyLimit: Number(settings.dailyLimit ?? 100),
    enabled: Boolean(settings.enabled),
    hasApiKey: Boolean(settings.hasApiKey),
    lastTestAt: typeof settings.lastTestAt === "string" ? settings.lastTestAt : null,
    lastTestMessage:
      typeof settings.lastTestMessage === "string" ? settings.lastTestMessage : null,
    lastTestStatus:
      settings.lastTestStatus === "success" || settings.lastTestStatus === "error"
        ? settings.lastTestStatus
        : null,
    maxTokens: Number(settings.maxTokens ?? 1200),
    model: typeof settings.model === "string" ? settings.model : "gemini-2.5-flash-lite",
    outputMode:
      settings.outputMode === "natural_text" ? "natural_text" : "strict_json",
    provider:
      settings.provider === "openai-compatible" ||
      settings.provider === "groq-compatible" ||
      settings.provider === "openrouter-compatible" ||
      settings.provider === "ollama-compatible"
        ? settings.provider
        : "gemini",
    temperature: Number(settings.temperature ?? 0.2),
  };
}

function mapUsageEvent(row: AiUsageRow): AiUsageEvent {
  return {
    completionTokens: row.completion_tokens,
    createdAt: row.created_at,
    feature: row.feature,
    id: row.id,
    profileNombre: firstRelation(row.profiles)?.nombre ?? null,
    promptTokens: row.prompt_tokens,
    provider: row.provider,
    status: row.status,
  };
}

export function canUseAi(tenant: TenantContext) {
  return (
    isModuleActive(tenant.activeModules, "ai") &&
    hasAnyPermission(tenant.permissions, ["ai.reports.use", "admin.settings.manage"])
  );
}

export async function getAiProviderSettings(
  tenant: TenantContext,
): Promise<CoreResult<AiProviderSettings>> {
  if (!isModuleActive(tenant.activeModules, "ai")) {
    return fail("MODULE_INACTIVE", "El modulo IA no esta activo.");
  }

  if (!hasAnyPermission(tenant.permissions, ["ai.reports.use", "admin.settings.manage"])) {
    return fail("PERMISSION_DENIED", "No tienes permiso para ver IA.");
  }

  const settings = await getBrainAiSettings(tenant);
  if (!settings.ok) return settings;

  return ok(normalizeSettings(settings.data));
}

export async function getAiUsageEvents(
  tenant: TenantContext,
): Promise<CoreResult<AiUsageEvent[]>> {
  if (!canUseAi(tenant)) {
    return ok([]);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_usage_events")
    .select(
      "id, profile_id, provider, feature, prompt_tokens, completion_tokens, status, created_at, profiles!ai_usage_events_profile_empresa_fkey(nombre)",
    )
    .eq("empresa_id", tenant.empresaId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return ok([]);
  }

  return ok(((data ?? []) as AiUsageRow[]).map(mapUsageEvent));
}
