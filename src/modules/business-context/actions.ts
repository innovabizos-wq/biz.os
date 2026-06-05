"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { businessContextSchema } from "@/modules/business-context/schemas";
import { canManageBusinessContext } from "@/modules/business-context/queries";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(message: string): never {
  redirect(`/admin/contexto?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`/admin/contexto?success=${encodeURIComponent(message)}`);
}

function clean(value: string | undefined) {
  return value ?? null;
}

function logBusinessContextActionError(actionName: string, error: RpcError) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

export async function saveBusinessContextAction(formData: FormData) {
  const parsed = businessContextSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("Revisa los campos del contexto del negocio.");
  }

  const access = await requireAdminAccess();

  if (!canManageBusinessContext(access.tenant)) {
    redirectWithError("No tienes permiso para guardar el contexto del negocio.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardar_contexto_negocio", {
    p_ai_instructions: clean(parsed.data.aiInstructions),
    p_brand_personality: clean(parsed.data.brandPersonality),
    p_business_hours: clean(parsed.data.businessHours),
    p_business_summary: clean(parsed.data.businessSummary),
    p_competitors: clean(parsed.data.competitors),
    p_core_values: clean(parsed.data.coreValues),
    p_customer_pain_points: clean(parsed.data.customerPainPoints),
    p_customer_service_rules: clean(parsed.data.customerServiceRules),
    p_differentiators: clean(parsed.data.differentiators),
    p_forbidden_topics: clean(parsed.data.forbiddenTopics),
    p_geographic_scope: clean(parsed.data.geographicScope),
    p_keywords: clean(parsed.data.keywords),
    p_main_offers: clean(parsed.data.mainOffers),
    p_mission: clean(parsed.data.mission),
    p_notes: clean(parsed.data.notes),
    p_operational_rules: clean(parsed.data.operationalRules),
    p_preferred_cta: clean(parsed.data.preferredCta),
    p_pricing_notes: clean(parsed.data.pricingNotes),
    p_products_services: clean(parsed.data.productsServices),
    p_required_disclaimers: clean(parsed.data.requiredDisclaimers),
    p_sales_rules: clean(parsed.data.salesRules),
    p_service_areas: clean(parsed.data.serviceAreas),
    p_service_process: clean(parsed.data.serviceProcess),
    p_target_audience: clean(parsed.data.targetAudience),
    p_tone_of_voice: clean(parsed.data.toneOfVoice),
    p_vision: clean(parsed.data.vision),
  });

  if (error) {
    logBusinessContextActionError("saveBusinessContextAction", error);
    redirectWithError("No se pudo guardar el contexto del negocio.");
  }

  revalidatePath("/admin/contexto");
  revalidatePath("/autoblog");
  revalidatePath("/autoblog/nuevo");
  redirectWithSuccess("Contexto del negocio guardado.");
}
