import { NextResponse } from "next/server";

import { getCurrentTenantContext } from "@/lib/auth/session";
import {
  getBrainActionPlans,
  getBrainMemory,
  getBrainRecommendations,
  getLatestBrainDailyMetrics,
} from "@/modules/brain/queries";

export async function GET() {
  const tenant = await getCurrentTenantContext();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error.message }, { status: 401 });
  }
  if (!tenant.data) {
    return NextResponse.json({ error: "Tenant no configurado." }, { status: 401 });
  }

  const [metrics, memory, recommendations, actionPlans] = await Promise.all([
    getLatestBrainDailyMetrics(tenant.data),
    getBrainMemory(tenant.data),
    getBrainRecommendations(tenant.data),
    getBrainActionPlans(tenant.data),
  ]);

  const firstError = [metrics, memory, recommendations, actionPlans].find(
    (result) => !result.ok,
  );

  if (firstError && !firstError.ok) {
    return NextResponse.json(
      { details: firstError.error.cause ?? null, error: firstError.error.message },
      { status: firstError.error.code === "PERMISSION_DENIED" ? 403 : 400 },
    );
  }

  return NextResponse.json({
    actionPlans: actionPlans.ok ? actionPlans.data : [],
    memory: memory.ok ? memory.data : [],
    metrics: metrics.ok ? metrics.data : null,
    recommendations: recommendations.ok ? recommendations.data : [],
  });
}
