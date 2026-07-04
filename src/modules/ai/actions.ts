"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import { aiProviderSettingsSchema, logAiUsageSchema } from "@/modules/ai/schemas";
import {
  testBrainAiConnection,
  updateBrainAiSettings,
} from "@/modules/brain/ai-service";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function assertAiAccess(manage = false) {
  const access = await requireAdminAccess();

  if (!isModuleActive(access.tenant.activeModules, "ai")) {
    redirectWithError("/dashboard", "El modulo IA no esta activo.");
  }

  const permissions = manage
    ? ["admin.settings.manage" as const]
    : ["ai.reports.use" as const, "admin.settings.manage" as const];

  if (!hasAnyPermission(access.tenant.permissions, permissions)) {
    redirectWithError("/admin/ia", "No tienes permiso para usar IA.");
  }

  return access;
}

export async function saveAiProviderSettingsAction(formData: FormData) {
  const parsed = aiProviderSettingsSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/ia", "Configuracion de IA invalida.");
  }

  const access = await assertAiAccess(true);

  const result = await updateBrainAiSettings(access.tenant, {
    apiKey: parsed.data.apiKey,
    baseUrl: parsed.data.baseUrl ?? null,
    dailyLimit: parsed.data.dailyLimit,
    enabled: parsed.data.enabled,
    maxTokens: parsed.data.maxTokens,
    model: parsed.data.model,
    outputMode: parsed.data.outputMode,
    provider: parsed.data.provider,
    temperature: parsed.data.temperature,
  });

  if (!result.ok) {
    redirectWithError("/admin/ia", result.error.message);
  }

  revalidatePath("/admin/ia");
  redirect("/admin/ia?success=Configuracion%20de%20IA%20guardada.");
}

export async function logAiOperationalTestAction(formData: FormData) {
  const parsed = logAiUsageSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/admin/ia", "Prueba IA invalida.");
  }

  await assertAiAccess(false);

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_ai_usage_event", {
    p_completion_tokens: 0,
    p_feature: parsed.data.feature ?? "operational-test",
    p_metadata: { source: "admin_ia" },
    p_prompt_tokens: 0,
    p_provider: null,
    p_status: "logged",
  });

  if (error) {
    redirectWithError("/admin/ia", "No se pudo registrar la prueba IA.");
  }

  revalidatePath("/admin/ia");
  redirect("/admin/ia?success=Evento%20IA%20registrado.");
}

export async function saveBrainAiSettingsAction(formData: FormData) {
  return saveAiProviderSettingsAction(formData);
}

export async function testBrainAiConnectionAction(formData?: FormData) {
  const access = await assertAiAccess(true);

  if (formData) {
    const parsed = aiProviderSettingsSchema.safeParse(getFormData(formData));

    if (!parsed.success) {
      redirectWithError("/admin/ia", "Configuracion de IA invalida.");
    }

    const saveResult = await updateBrainAiSettings(access.tenant, {
      apiKey: parsed.data.apiKey,
      baseUrl: parsed.data.baseUrl ?? null,
      dailyLimit: parsed.data.dailyLimit,
      enabled: parsed.data.enabled,
      maxTokens: parsed.data.maxTokens,
      model: parsed.data.model,
      outputMode: parsed.data.outputMode,
      provider: parsed.data.provider,
      temperature: parsed.data.temperature,
    });

    if (!saveResult.ok) {
      redirectWithError("/admin/ia", saveResult.error.message);
    }
  }

  const result = await testBrainAiConnection(access.tenant);

  if (!result.ok) {
    revalidatePath("/admin/ia");
    redirectWithError("/admin/ia", result.error.message);
  }

  revalidatePath("/admin/ia");
  redirect("/admin/ia?success=Conexion%20de%20IA%20correcta.");
}
