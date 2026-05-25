import type { CoreResult, EmpresaPlan, JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

export function isPlanActive(empresaPlan: Pick<EmpresaPlan, "estado">): boolean {
  return empresaPlan.estado === "activo";
}

export function canUsePlanFeature(
  planLimits: JsonRecord,
  featureKey: string,
): boolean {
  return Boolean(planLimits[featureKey]);
}

export function requirePlanFeature(
  planLimits: JsonRecord,
  featureKey: string,
): CoreResult<string> {
  if (!canUsePlanFeature(planLimits, featureKey)) {
    return fail(
      "PLAN_FEATURE_UNAVAILABLE",
      `Funcion no disponible por plan: ${featureKey}`,
    );
  }

  return ok(featureKey);
}
