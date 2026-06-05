import { createClient } from "@/lib/supabase/server";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import type { BusinessContext } from "@/modules/business-context/types";
import type { CoreResult, TenantContext } from "@/types/core";
import { fail, ok } from "@/types/core";

type BusinessContextRow = {
  ai_instructions: string | null;
  brand_personality: string | null;
  business_hours: string | null;
  business_summary: string | null;
  competitors: string | null;
  core_values: string | null;
  created_at: string;
  created_by: string | null;
  customer_pain_points: string | null;
  customer_service_rules: string | null;
  differentiators: string | null;
  forbidden_topics: string | null;
  geographic_scope: string | null;
  id: string;
  keywords: string | null;
  main_offers: string | null;
  mission: string | null;
  notes: string | null;
  operational_rules: string | null;
  preferred_cta: string | null;
  pricing_notes: string | null;
  products_services: string | null;
  required_disclaimers: string | null;
  sales_rules: string | null;
  service_areas: string | null;
  service_process: string | null;
  target_audience: string | null;
  tone_of_voice: string | null;
  updated_at: string;
  updated_by: string | null;
  vision: string | null;
};

export function canViewBusinessContext(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, [
    "admin.settings.view",
    "admin.settings.manage",
  ]);
}

export function canManageBusinessContext(tenant: TenantContext) {
  return hasAnyPermission(tenant.permissions, ["admin.settings.manage"]);
}

function mapBusinessContext(row: BusinessContextRow): BusinessContext {
  return {
    aiInstructions: row.ai_instructions,
    brandPersonality: row.brand_personality,
    businessHours: row.business_hours,
    businessSummary: row.business_summary,
    competitors: row.competitors,
    coreValues: row.core_values,
    createdAt: row.created_at,
    createdBy: row.created_by,
    customerPainPoints: row.customer_pain_points,
    customerServiceRules: row.customer_service_rules,
    differentiators: row.differentiators,
    forbiddenTopics: row.forbidden_topics,
    geographicScope: row.geographic_scope,
    id: row.id,
    keywords: row.keywords,
    mainOffers: row.main_offers,
    mission: row.mission,
    notes: row.notes,
    operationalRules: row.operational_rules,
    preferredCta: row.preferred_cta,
    pricingNotes: row.pricing_notes,
    productsServices: row.products_services,
    requiredDisclaimers: row.required_disclaimers,
    salesRules: row.sales_rules,
    serviceAreas: row.service_areas,
    serviceProcess: row.service_process,
    targetAudience: row.target_audience,
    toneOfVoice: row.tone_of_voice,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    vision: row.vision,
  };
}

export async function getBusinessContext(
  tenant: TenantContext,
): Promise<CoreResult<BusinessContext | null>> {
  if (!canViewBusinessContext(tenant)) {
    return fail(
      "PERMISSION_DENIED",
      "No tienes permiso para ver el contexto del negocio.",
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("obtener_contexto_negocio");

  if (error) {
    return fail(
      "PERMISSION_DENIED",
      "No se pudo cargar el contexto del negocio.",
      error,
    );
  }

  const row = ((data ?? []) as BusinessContextRow[])[0];

  return ok(row ? mapBusinessContext(row) : null);
}
